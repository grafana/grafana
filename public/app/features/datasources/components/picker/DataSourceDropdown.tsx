import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';
import React, { useCallback, useRef, useState } from 'react';
import { usePopper } from 'react-popper';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { DataSourceJsonData } from '@grafana/schema';
import { Button, CustomScrollbar, Icon, Input, ModalsController, Portal, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

import { useDatasource } from '../../hooks';

import { DataSourceList } from './DataSourceList';
import { DataSourceLogo, DataSourceLogoPlaceHolder } from './DataSourceLogo';
import { DataSourceModal } from './DataSourceModal';
import { PickerContentProps, DataSourceDropdownProps } from './types';
import { dataSourceLabel } from './utils';

const INTERACTION_EVENT_NAME = 'dashboards_dspicker_clicked';
const INTERACTION_ITEM = {
  OPEN_DROPDOWN: 'open_dspicker',
  SELECT_DS: 'select_ds',
  ADD_FILE: 'add_file',
  OPEN_ADVANCED_DS_PICKER: 'open_advanced_ds_picker',
};

export function DataSourceDropdown(props: DataSourceDropdownProps) {
  const { current, onChange, ...restProps } = props;

  const [isOpen, setOpen] = useState(false);
  const [markerElement, setMarkerElement] = useState<HTMLInputElement | null>();
  const [selectorElement, setSelectorElement] = useState<HTMLDivElement | null>();
  const [filterTerm, setFilterTerm] = useState<string>();
  const openDropdown = () => {
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.OPEN_DROPDOWN });
    setOpen(true);
    markerElement?.focus();
  };

  const currentDataSourceInstanceSettings = useDatasource(current);

  const popper = usePopper(markerElement, selectorElement, {
    placement: 'bottom-start',
  });

  const onClose = useCallback(() => {
    setFilterTerm('');
    setOpen(false);
    markerElement?.blur();
  }, [setOpen, markerElement]);

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(
    {
      onClose: onClose,
      isDismissable: true,
      isOpen,
      shouldCloseOnInteractOutside: (element) => {
        return markerElement ? !markerElement.isSameNode(element) : false;
      },
    },
    ref
  );
  const { dialogProps } = useDialog({}, ref);

  const styles = useStyles2(getStylesDropdown);

  return (
    <div className={styles.container}>
      <div tabIndex={0} onFocus={openDropdown} role={'button'} className={styles.trigger} onClick={openDropdown}>
        <Input
          className={isOpen ? undefined : styles.input}
          prefix={
            filterTerm && isOpen ? (
              <DataSourceLogoPlaceHolder />
            ) : (
              <DataSourceLogo dataSource={currentDataSourceInstanceSettings} />
            )
          }
          suffix={<Icon name={isOpen ? 'search' : 'angle-down'} />}
          placeholder={dataSourceLabel(currentDataSourceInstanceSettings)}
          onFocus={openDropdown}
          onClick={openDropdown}
          value={filterTerm}
          onChange={(e) => {
            setFilterTerm(e.currentTarget.value);
          }}
          ref={setMarkerElement}
        ></Input>
      </div>
      {isOpen ? (
        <Portal>
          <div {...underlayProps} />
          <div ref={ref} {...overlayProps} {...dialogProps}>
            <PickerContent
              filterTerm={filterTerm}
              onChange={(ds: DataSourceInstanceSettings<DataSourceJsonData>) => {
                onClose();
                onChange(ds);
              }}
              onClose={onClose}
              current={currentDataSourceInstanceSettings}
              style={popper.styles.popper}
              ref={setSelectorElement}
              {...restProps}
              onDismiss={onClose}
            ></PickerContent>
          </div>
        </Portal>
      ) : null}
    </div>
  );
}

function getStylesDropdown(theme: GrafanaTheme2) {
  return {
    container: css`
      position: relative;
    `,
    trigger: css`
      cursor: pointer;
    `,
    input: css`
      input {
        cursor: pointer;
      }
      input::placeholder {
        color: ${theme.colors.text.primary};
      }
    `,
  };
}

const PickerContent = React.forwardRef<HTMLDivElement, PickerContentProps>((props, ref) => {
  const { filterTerm, onChange, onClose, onClickAddCSV, current } = props;
  const changeCallback = useCallback(
    (ds: DataSourceInstanceSettings<DataSourceJsonData>) => {
      onChange(ds);
      reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.SELECT_DS, ds_type: ds.type });
    },
    [onChange]
  );

  const clickAddCSVCallback = useCallback(() => {
    onClickAddCSV?.();
    onClose();
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.ADD_FILE });
  }, [onClickAddCSV, onClose]);

  const styles = useStyles2(getStylesPickerContent);

  return (
    <div style={props.style} ref={ref} className={styles.container}>
      <div className={styles.dataSourceList}>
        <CustomScrollbar>
          <DataSourceList
            {...props}
            current={current}
            onChange={changeCallback}
            filter={(ds) => ds.name.toLowerCase().includes(filterTerm?.toLowerCase() ?? '')}
          ></DataSourceList>
        </CustomScrollbar>
      </div>

      <div className={styles.footer}>
        {onClickAddCSV && config.featureToggles.editPanelCSVDragAndDrop && (
          <Button variant="secondary" size="sm" onClick={clickAddCSVCallback}>
            Add csv or spreadsheet
          </Button>
        )}
        <ModalsController>
          {({ showModal, hideModal }) => (
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              onClick={() => {
                onClose();
                showModal(DataSourceModal, {
                  enableFileUpload: props.enableFileUpload,
                  fileUploadOptions: props.fileUploadOptions,
                  reportedInteractionFrom: 'ds_picker',
                  current,
                  onDismiss: hideModal,
                  onChange: (ds) => {
                    onChange(ds);
                    hideModal();
                  },
                });
                reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.OPEN_ADVANCED_DS_PICKER });
              }}
            >
              Open advanced data source picker
              <Icon name="arrow-right" />
            </Button>
          )}
        </ModalsController>
      </div>
    </div>
  );
});
PickerContent.displayName = 'PickerContent';

function getStylesPickerContent(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      height: 412px;
      box-shadow: ${theme.shadows.z3};
      width: 480px;
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
    `,
    picker: css`
      background: ${theme.colors.background.secondary};
    `,
    dataSourceList: css`
      flex: 1;
      height: 100%;
    `,
    footer: css`
      flex: 0;
      display: flex;
      justify-content: space-between;
      padding: ${theme.spacing(1.5)};
      border-top: 1px solid ${theme.colors.border.weak};
      background-color: ${theme.colors.background.secondary};
    `,
  };
}
