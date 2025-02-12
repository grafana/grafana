import { css } from '@emotion/css';
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { debounce } from 'lodash';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import * as React from 'react';
import { Observable } from 'rxjs';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { Button, Icon, Input, ModalsController, Portal, ScrollContainer, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { Trans } from 'app/core/internationalization';
import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { defaultFileUploadQuery, GrafanaQuery } from 'app/plugins/datasource/grafana/types';

import { useDatasource } from '../../hooks';

import { DataSourceList } from './DataSourceList';
import { DataSourceLogo, DataSourceLogoPlaceHolder } from './DataSourceLogo';
import { DataSourceModal } from './DataSourceModal';
import { dataSourceLabel, matchDataSourceWithSearch } from './utils';

const INTERACTION_EVENT_NAME = 'dashboards_dspicker_clicked';
const INTERACTION_ITEM = {
  SEARCH: 'search',
  OPEN_DROPDOWN: 'open_dspicker',
  SELECT_DS: 'select_ds',
  ADD_FILE: 'add_file',
  OPEN_ADVANCED_DS_PICKER: 'open_advanced_ds_picker',
  CONFIG_NEW_DS_EMPTY_STATE: 'config_new_ds_empty_state',
};

export interface DataSourcePickerProps {
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

export function DataSourcePicker(props: DataSourcePickerProps) {
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

  const styles = useStyles2(getStylesDropdown, props);
  const [isOpen, setOpen] = useState(false);
  const [inputHasFocus, setInputHasFocus] = useState(false);
  const [filterTerm, setFilterTerm] = useState<string>('');
  const { onKeyDown, keyboardEvents } = useKeyNavigationListener();
  const ref = useRef<HTMLDivElement>(null);
  const debouncedTrackSearch = useMemo(
    () =>
      debounce((q) => {
        reportInteraction(INTERACTION_EVENT_NAME, {
          item: INTERACTION_ITEM.SEARCH,
          query: q,
          creator_team: 'grafana_plugins_catalog',
          schema_version: '1.0.0',
        });
      }, 300),
    []
  );

  // Used to position the popper correctly and to bring back the focus when navigating from footer to input
  const [markerElement, setMarkerElement] = useState<HTMLInputElement | null>();
  // Used to move the focus to the footer when tabbing from the input
  const [footerRef, setFooterRef] = useState<HTMLElement | null>();
  const currentDataSourceInstanceSettings = useDatasource(current);
  const grafanaDS = useDatasource('-- Grafana --');
  const currentValue = Boolean(!current && noDefault) ? undefined : currentDataSourceInstanceSettings;
  const prefixIcon =
    filterTerm && isOpen ? <DataSourceLogoPlaceHolder /> : <DataSourceLogo dataSource={currentValue} />;

  // the order of middleware is important!
  const middleware = [
    offset(4),
    size({
      apply({ availableHeight, elements }) {
        const margin = 20;
        const minSize = 200;
        elements.floating.style.maxHeight = `${Math.max(minSize, availableHeight - margin)}px`;
        elements.floating.style.minHeight = `${minSize}px`;
      },
    }),
    flip({
      fallbackStrategy: 'initialPlacement',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    onOpenChange: setOpen,
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const handleReference = useCallback(
    (element: HTMLInputElement | null) => {
      refs.setReference(element);
      setMarkerElement(element);
    },
    [refs]
  );

  const onClose = useCallback(() => {
    setFilterTerm('');
    setOpen(false);
    markerElement?.focus();
  }, [setOpen, markerElement]);

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

  function openDropdown() {
    setOpen(true);
    markerElement?.focus();
  }

  function onClickAddCSV() {
    if (!grafanaDS) {
      return;
    }

    onChange(grafanaDS, [defaultFileUploadQuery]);
  }

  function onKeyDownInput(keyEvent: React.KeyboardEvent<HTMLInputElement>) {
    // From the input, it navigates to the footer
    if (keyEvent.key === 'Tab' && !keyEvent.shiftKey && isOpen) {
      keyEvent.preventDefault();
      footerRef?.focus();
    }
    // From the input, if we navigate back, it closes the dropdown
    if (keyEvent.key === 'Tab' && keyEvent.shiftKey && isOpen) {
      onClose();
    }
    onKeyDown(keyEvent);
  }

  function onNavigateOutsiteFooter(e: React.KeyboardEvent<HTMLButtonElement>) {
    // When navigating back, the dropdown keeps open and the input element is focused.
    if (e.shiftKey) {
      e.preventDefault();
      markerElement?.focus();
      // When navigating forward, the dropdown closes and the element next to the input element is focused.
    } else {
      onClose();
    }
  }

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

  return (
    <div className={styles.container} data-testid={selectors.components.DataSourcePicker.container}>
      {/* This clickable div is just extending the clickable area on the input element to include the prefix and suffix. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={styles.trigger}
        onClick={() => {
          openDropdown();
          reportInteraction(INTERACTION_EVENT_NAME, {
            item: INTERACTION_ITEM.OPEN_DROPDOWN,
            creator_team: 'grafana_plugins_catalog',
            schema_version: '1.0.0',
          });
        }}
      >
        <Input
          id={inputId || 'data-source-picker'}
          className={inputHasFocus ? undefined : styles.input}
          data-testid={selectors.components.DataSourcePicker.inputV2}
          aria-label="Select a data source"
          autoComplete="off"
          prefix={currentValue ? prefixIcon : undefined}
          suffix={<Icon name={isOpen ? 'search' : 'angle-down'} />}
          placeholder={hideTextValue ? '' : dataSourceLabel(currentValue) || placeholder}
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
            if (e.currentTarget.value) {
              debouncedTrackSearch(e.currentTarget.value);
            }
          }}
          ref={handleReference}
          disabled={disabled}
        ></Input>
      </div>
      {isOpen ? (
        <Portal>
          <div {...underlayProps} />
          <div ref={ref} {...overlayProps} {...dialogProps}>
            <PickerContent
              {...restProps}
              style={floatingStyles}
              ref={refs.setFloating}
              footerRef={setFooterRef}
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
              onNavigateOutsiteFooter={onNavigateOutsiteFooter}
            />
          </div>
        </Portal>
      ) : null}
    </div>
  );
}

function getStylesDropdown(theme: GrafanaTheme2, props: DataSourcePickerProps) {
  return {
    container: css({
      position: 'relative',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      width: theme.spacing(props.width || 'auto'),
    }),
    trigger: css({
      cursor: 'pointer',
      pointerEvents: props.disabled ? 'none' : 'auto',
    }),
    input: css({
      'input::placeholder': {
        color: props.disabled ? theme.colors.action.disabledText : theme.colors.text.primary,
      },
    }),
  };
}

export interface PickerContentProps extends DataSourcePickerProps {
  onClickAddCSV?: () => void;
  keyboardEvents: Observable<React.KeyboardEvent>;
  style: React.CSSProperties;
  filterTerm?: string;
  onClose: () => void;
  onDismiss: () => void;
  footerRef: (element: HTMLElement | null) => void;
  onNavigateOutsiteFooter: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
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
      <ScrollContainer showScrollIndicators>
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
      </ScrollContainer>
      <FocusScope>
        <Footer
          {...props}
          onClickAddCSV={clickAddCSVCallback}
          onChange={changeCallback}
          onNavigateOutsiteFooter={props.onNavigateOutsiteFooter}
        />
      </FocusScope>
    </div>
  );
});
PickerContent.displayName = 'PickerContent';

function getStylesPickerContent(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.background.elevated,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      overflow: 'hidden',
    }),
    picker: css({
      background: theme.colors.background.secondary,
    }),
    dataSourceList: css({
      flex: 1,
    }),
    footer: css({
      flex: 0,
      display: 'flex',
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      padding: theme.spacing(1.5),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      backgroundColor: theme.colors.background.secondary,
    }),
  };
}

export interface FooterProps extends PickerContentProps {}

function Footer({ onClose, onChange, onClickAddCSV, ...props }: FooterProps) {
  const styles = useStyles2(getStylesFooter);
  const isUploadFileEnabled = props.uploadFile && config.featureToggles.editPanelCSVDragAndDrop;

  const onKeyDownLastButton = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Tab') {
      props.onNavigateOutsiteFooter(e);
    }
  };
  const onKeyDownFirstButton = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Tab' && e.shiftKey) {
      props.onNavigateOutsiteFooter(e);
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
            ref={props.footerRef}
            onKeyDown={isUploadFileEnabled ? onKeyDownFirstButton : onKeyDownLastButton}
          >
            <Trans i18nKey="data-source-picker.open-advanced-button">Open advanced data source picker</Trans>
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
    footer: css({
      flex: 0,
      display: 'flex',
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      padding: theme.spacing(1.5),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      backgroundColor: theme.colors.background.secondary,
    }),
  };
}
