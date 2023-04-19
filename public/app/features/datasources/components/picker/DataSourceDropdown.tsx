import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { useCallback, useRef, useState } from 'react';
import { usePopper } from 'react-popper';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataSourceJsonData } from '@grafana/schema';
import { Button, CustomScrollbar, Icon, Input, ModalsController, Portal, useStyles2 } from '@grafana/ui';

import { DataSourceList } from './DataSourceList';
import { DataSourceLogo, DataSourceLogoPlaceHolder } from './DataSourceLogo';
import { DataSourceModal } from './DataSourceModal';
import { PickerContentProps, DataSourceDropdownProps } from './types';
import { dataSourceName, useGetDatasource } from './utils';

export function DataSourceDropdown(props: DataSourceDropdownProps) {
  const { current, onChange, ...restProps } = props;
  const [isOpen, setOpen] = useState(false);

  const [markerElement, setMarkerElement] = useState<HTMLInputElement | null>();
  const [selectorElement, setSelectorElement] = useState<HTMLDivElement | null>();
  const [filterTerm, setFilterTerm] = useState<string>();

  const getDataSource = useGetDatasource();
  const currentDataSourceInstanceSettings = getDataSource(current);

  const popper = usePopper(markerElement, selectorElement, {
    placement: 'bottom-start',
  });

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(
    {
      onClose: () => {
        setFilterTerm(undefined);
        setOpen(false);
      },
      isDismissable: true,
      isOpen,
      shouldCloseOnInteractOutside: (element) => {
        return markerElement ? !markerElement.isSameNode(element) : false;
      },
    },
    ref
  );
  const { dialogProps } = useDialog({}, ref);

  return (
    <div style={{ position: 'relative' }}>
      {isOpen ? (
        <FocusScope contain autoFocus restoreFocus>
          <Input
            prefix={
              filterTerm ? (
                <DataSourceLogoPlaceHolder />
              ) : (
                <DataSourceLogo dataSource={currentDataSourceInstanceSettings}></DataSourceLogo>
              )
            }
            suffix={<Icon name={filterTerm ? 'search' : 'angle-down'}></Icon>}
            placeholder={dataSourceName(currentDataSourceInstanceSettings)}
            onChange={(e) => {
              setFilterTerm(e.currentTarget.value);
            }}
            ref={setMarkerElement}
          ></Input>
          <Portal>
            <div {...underlayProps} />
            <div ref={ref} {...overlayProps} {...dialogProps}>
              <PickerContent
                filterTerm={filterTerm}
                onChange={(ds: DataSourceInstanceSettings<DataSourceJsonData>) => {
                  setFilterTerm(undefined);
                  setOpen(false);
                  onChange(ds);
                }}
                onClose={() => {
                  setOpen(false);
                }}
                current={currentDataSourceInstanceSettings}
                style={popper.styles.popper}
                ref={setSelectorElement}
                {...restProps}
                onDismiss={() => {}}
              ></PickerContent>
            </div>
          </Portal>
        </FocusScope>
      ) : (
        <div
          className={css`
            cursor: pointer;
            input {
              cursor: pointer;
            }
          `}
          onClick={() => {
            setOpen(true);
          }}
        >
          <Input
            prefix={<DataSourceLogo dataSource={currentDataSourceInstanceSettings}></DataSourceLogo>}
            suffix={<Icon name="angle-down"></Icon>}
            value={dataSourceName(currentDataSourceInstanceSettings)}
            onFocus={() => {
              setOpen(true);
            }}
          ></Input>
        </div>
      )}
    </div>
  );
}

const PickerContent = React.forwardRef<HTMLDivElement, PickerContentProps>((props, ref) => {
  const { filterTerm, onChange, onClose, onClickAddCSV, current } = props;
  const changeCallback = useCallback(
    (ds: DataSourceInstanceSettings<DataSourceJsonData>) => {
      onChange(ds);
    },
    [onChange]
  );

  const clickAddCSVCallback = useCallback(() => {
    onClickAddCSV?.();
    onClose();
  }, [onClickAddCSV, onClose]);

  const styles = useStyles2(getStyles);

  return (
    <div style={props.style} ref={ref} className={styles.container}>
      <div className={styles.dataSourceList}>
        <CustomScrollbar>
          <DataSourceList
            current={current}
            onChange={changeCallback}
            filter={(ds) => !ds.meta.builtIn && ds.name.toLowerCase().includes(filterTerm?.toLowerCase() ?? '')}
          ></DataSourceList>
        </CustomScrollbar>
      </div>

      <div className={styles.footer}>
        {onClickAddCSV && (
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
                  current,
                  onDismiss: hideModal,
                  onChange: (ds) => {
                    onChange(ds);
                    hideModal();
                  },
                });
              }}
            >
              Open advanced data source picker
              <Icon name="arrow-right"></Icon>
            </Button>
          )}
        </ModalsController>
      </div>
    </div>
  );
});
PickerContent.displayName = 'PickerContent';

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      height: 480px;
      box-shadow: ${theme.shadows.z3};
      width: 480px;
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
    `,
    picker: css`
      background: ${theme.colors.background.secondary};
    `,
    dataSourceList: css`
      height: 423px;
      padding: 0 ${theme.spacing(2)};
    `,
    footer: css`
      display: flex;
      justify-content: space-between;
      padding: ${theme.spacing(2)};
      border-top: 1px solid ${theme.colors.border.weak};
      height: 57px;
    `,
  };
}
