import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope, useFocusManager } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { usePopper } from 'react-popper';
import { Observable } from 'rxjs';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { Button, CustomScrollbar, Icon, Input, ModalsController, Portal, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { defaultFileUploadQuery, GrafanaQuery } from 'app/plugins/datasource/grafana/types';

import { useDatasource } from '../../hooks';

import { DataSourceList } from './DataSourceList';
import { DataSourceLogo, DataSourceLogoPlaceHolder } from './DataSourceLogo';
import { DataSourceModal } from './DataSourceModal';
import { applyMaxSize, maxSize } from './popperModifiers';
import { dataSourceLabel, matchDataSourceWithSearch } from './utils';

const INTERACTION_EVENT_NAME = 'dashboards_dspicker_clicked';
const INTERACTION_ITEM = {
  OPEN_DROPDOWN: 'open_dspicker',
  SELECT_DS: 'select_ds',
  ADD_FILE: 'add_file',
  OPEN_ADVANCED_DS_PICKER: 'open_advanced_ds_picker',
  CONFIG_NEW_DS_EMPTY_STATE: 'config_new_ds_empty_state',
};

export interface DataSourceDropdownProps {
  onChange: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => void;
  current?: DataSourceInstanceSettings | string | DataSourceRef | null;
  recentlyUsed?: string[];
  hideTextValue?: boolean;
  width?: number;
  inputId?: string;
  noDefault?: boolean;
  disabled?: boolean;
  placeholder?: string;

  // DS filters
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  logs?: boolean;
  uploadFile?: boolean;
  filter?: (ds: DataSourceInstanceSettings) => boolean;
}

export function DataSourceDropdown(props: DataSourceDropdownProps) {
  const {
    current,
    onChange,
    hideTextValue = false,
    width,
    inputId,
    noDefault = false,
    disabled = false,
    placeholder = 'Select data source',
    ...restProps
  } = props;

  const [isOpen, setOpen] = useState(false);
  const [inputHasFocus, setInputHasFocus] = useState(false);
  const [filterTerm, setFilterTerm] = useState<string>('');

  // Used to position the popper correctly
  const [markerElement, setMarkerElement] = useState<HTMLInputElement | null>();
  const [selectorElement, setSelectorElement] = useState<HTMLDivElement | null>();

  // Used to handle tabbing inside the dropdown before closing it
  const [footerRef, setFooterRef] = useState<HTMLElement | null>();

  const openDropdown = () => {
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.OPEN_DROPDOWN });
    setOpen(true);
    markerElement?.focus();
  };
  const currentDataSourceInstanceSettings = useDatasource(current);
  const currentValue = Boolean(!current && noDefault) ? undefined : currentDataSourceInstanceSettings;
  const prefixIcon =
    filterTerm && isOpen ? <DataSourceLogoPlaceHolder /> : <DataSourceLogo dataSource={currentValue} />;

  const { onKeyDown, keyboardEvents } = useKeyNavigationListener();

  useEffect(() => {
    const sub = keyboardEvents.subscribe({
      next: (keyEvent) => {
        switch (keyEvent?.code) {
          case 'ArrowDown':
            openDropdown();
            keyEvent.preventDefault();
            break;
          case 'ArrowUp':
            openDropdown();
            keyEvent.preventDefault();
            break;
          case 'Escape':
            onClose();
            keyEvent.preventDefault();
            break;
        }
      },
    });
    return () => sub.unsubscribe();
  });
  const grafanaDS = useDatasource('-- Grafana --');

  const onClickAddCSV = () => {
    if (!grafanaDS) {
      return;
    }

    onChange(grafanaDS, [defaultFileUploadQuery]);
  };

  function onKeyDownInput(keyEvent: React.KeyboardEvent<HTMLInputElement>) {
    if (keyEvent.key === 'Tab' && !keyEvent.shiftKey && isOpen) {
      keyEvent.preventDefault();
      footerRef?.focus();
    }
    if (keyEvent.key === 'Tab' && keyEvent.shiftKey && isOpen) {
      onClose();
    }
    onKeyDown(keyEvent);
  }

  const popper = usePopper(markerElement, selectorElement, {
    placement: 'bottom-start',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 4],
        },
      },
      maxSize,
      applyMaxSize,
    ],
  });

  const onClose = useCallback(() => {
    setFilterTerm('');
    setOpen(false);
    markerElement?.focus();
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
  const { dialogProps } = useDialog(
    {
      'aria-label': 'Opened data source picker list',
    },
    ref
  );

  const styles = useStyles2((theme: GrafanaTheme2) => getStylesDropdown(theme, props));

  return (
    <div className={styles.container} data-testid={selectors.components.DataSourcePicker.container}>
      {/* This clickable div is just extending the clickable area on the input element to include the prefix and suffix. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={styles.trigger} onClick={openDropdown}>
        <Input
          id={inputId || 'data-source-picker'}
          className={inputHasFocus ? undefined : styles.input}
          data-testid={selectors.components.DataSourcePicker.inputV2}
          prefix={currentValue ? prefixIcon : undefined}
          suffix={<Icon name={isOpen ? 'search' : 'angle-down'} />}
          placeholder={hideTextValue ? '' : dataSourceLabel(currentValue) || placeholder}
          onClick={openDropdown}
          onFocus={() => {
            setInputHasFocus(true);
          }}
          onBlur={() => {
            setInputHasFocus(false);
          }}
          onKeyDown={onKeyDownInput}
          value={filterTerm}
          onChange={(e) => {
            openDropdown();
            setFilterTerm(e.currentTarget.value);
          }}
          ref={setMarkerElement}
          disabled={disabled}
        ></Input>
      </div>
      {isOpen ? (
        <Portal>
          <div {...underlayProps} />
          <div ref={ref} {...overlayProps} {...dialogProps}>
            <PickerContent
              {...restProps}
              {...popper.attributes.popper}
              style={popper.styles.popper}
              ref={setSelectorElement}
              firstElementRef={setFooterRef}
              current={currentValue}
              filterTerm={filterTerm}
              keyboardEvents={keyboardEvents}
              onChange={(ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => {
                onClose();
                if (ds.uid !== currentValue?.uid) {
                  onChange(ds, defaultQueries);
                  reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.SELECT_DS, ds_type: ds.type });
                }
              }}
              onClose={onClose}
              onClickAddCSV={onClickAddCSV}
              onDismiss={onClose}
              onBlurFooter={(e) => {
                // When navigating back, the dropdown keeps open and the input element is focused.
                if (e.shiftKey) {
                  e.preventDefault();
                  markerElement?.focus();
                  // When navigating forward, the dropdown closes and and the element next to the input element is focused.
                } else {
                  onClose();
                }
              }}
            />
          </div>
        </Portal>
      ) : null}
    </div>
  );
}

function getStylesDropdown(theme: GrafanaTheme2, props: DataSourceDropdownProps) {
  return {
    container: css`
      position: relative;
      cursor: ${props.disabled ? 'not-allowed' : 'pointer'};
      width: ${theme.spacing(props.width || 'auto')};
    `,
    trigger: css`
      cursor: pointer;
      ${props.disabled && `pointer-events: none;`}
    `,
    input: css`
      input::placeholder {
        color: ${props.disabled ? theme.colors.action.disabledText : theme.colors.text.primary};
      }
    `,
  };
}

export interface PickerContentProps extends DataSourceDropdownProps {
  onClickAddCSV?: () => void;
  keyboardEvents: Observable<React.KeyboardEvent>;
  style: React.CSSProperties;
  filterTerm?: string;
  onClose: () => void;
  onDismiss: () => void;
}

const PickerContent = React.forwardRef<HTMLDivElement, PickerContentProps>((props, ref) => {
  const { filterTerm, onChange, onClose, onClickAddCSV, current, filter } = props;

  const changeCallback = useCallback(
    (ds: DataSourceInstanceSettings) => {
      onChange(ds);
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
      <CustomScrollbar>
        <DataSourceList
          {...props}
          enableKeyboardNavigation
          className={styles.dataSourceList}
          current={current}
          onChange={changeCallback}
          filter={(ds) => (filter ? filter?.(ds) : true) && matchDataSourceWithSearch(ds, filterTerm)}
          onClickEmptyStateCTA={() =>
            reportInteraction(INTERACTION_EVENT_NAME, {
              item: INTERACTION_ITEM.CONFIG_NEW_DS_EMPTY_STATE,
            })
          }
        ></DataSourceList>
      </CustomScrollbar>
      <FocusScope>
        <Footer
          {...props}
          onClickAddCSV={clickAddCSVCallback}
          onChange={changeCallback}
          onBlurFooter={props.onBlurFooter}
        />
      </FocusScope>
    </div>
  );
});
PickerContent.displayName = 'PickerContent';

function getStylesPickerContent(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
    `,
    picker: css`
      background: ${theme.colors.background.secondary};
    `,
    dataSourceList: css`
      flex: 1;
    `,
    footer: css`
      flex: 0;
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      padding: ${theme.spacing(1.5)};
      border-top: 1px solid ${theme.colors.border.weak};
      background-color: ${theme.colors.background.secondary};
    `,
  };
}

export interface FooterProps extends PickerContentProps {
  firstElementRef?: React.RefObject<HTMLButtonElement>;
  onBlurFooter: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

function Footer({ onClose, onChange, onClickAddCSV, ...props }: FooterProps) {
  const styles = useStyles2(getStylesFooter);
  const isUploadFileEnabled = props.uploadFile && config.featureToggles.editPanelCSVDragAndDrop;

  const onKeyDownLastButton = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Tab') {
      props.onBlurFooter(e);
    }
  };
  const onKeyDownFirstButton = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Tab' && e.shiftKey) {
      props.onBlurFooter(e);
    }
  };

  return (
    <div className={styles.footer}>
      <ModalsController>
        {({ showModal, hideModal }) => (
          <Button
            size="sm"
            variant="secondary"
            fill="text"
            onClick={() => {
              onClose();
              showModal(DataSourceModal, {
                reportedInteractionFrom: 'ds_picker',
                tracing: props.tracing,
                dashboard: props.dashboard,
                mixed: props.mixed,
                metrics: props.metrics,
                type: props.type,
                annotations: props.annotations,
                variables: props.variables,
                alerting: props.alerting,
                pluginId: props.pluginId,
                logs: props.logs,
                filter: props.filter,
                uploadFile: props.uploadFile,
                current: props.current,
                onDismiss: hideModal,
                onChange: (ds, defaultQueries) => {
                  onChange(ds, defaultQueries);
                  hideModal();
                },
              });
              reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.OPEN_ADVANCED_DS_PICKER });
            }}
            ref={props.firstElementRef}
            onKeyDown={isUploadFileEnabled ? onKeyDownFirstButton : onKeyDownLastButton}
          >
            Open advanced data source picker
            <Icon name="arrow-right" />
          </Button>
        )}
      </ModalsController>
      {isUploadFileEnabled && (
        <Button variant="secondary" size="sm" onClick={onClickAddCSV} onKeyDown={onKeyDownLastButton}>
          Add csv or spreadsheet
        </Button>
      )}
    </div>
  );
}

function getStylesFooter(theme: GrafanaTheme2) {
  return {
    footer: css`
      flex: 0;
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      padding: ${theme.spacing(1.5)};
      border-top: 1px solid ${theme.colors.border.weak};
      background-color: ${theme.colors.background.secondary};
    `,
  };
}
