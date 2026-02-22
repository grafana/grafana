import { css } from '@emotion/css';
import { autoUpdate, offset, size, useFloating } from '@floating-ui/react';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { debounce } from 'lodash';
import { useCallback, useRef, useState, useMemo } from 'react';
import * as React from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { FavoriteDatasources, reportInteraction, useFavoriteDatasources } from '@grafana/runtime';
import { DataQuery, DataSourceJsonData, DataSourceRef } from '@grafana/schema';
import { Button, floatingUtils, Icon, Input, ModalsController, Portal, ScrollContainer, useStyles2 } from '@grafana/ui';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';

import { useDatasource, useDatasources } from '../../hooks';

import { DataSourceList } from './DataSourceList';
import { DataSourceLogo, DataSourceLogoPlaceHolder } from './DataSourceLogo';
import { DataSourceModal } from './DataSourceModal';
import { dataSourceLabel, matchDataSourceWithSearch } from './utils';

export const INTERACTION_EVENT_NAME = 'dashboards_dspicker_clicked';
export const INTERACTION_ITEM = {
  SEARCH: 'search',
  OPEN_DROPDOWN: 'open_dspicker',
  SELECT_DS: 'select_ds',
  OPEN_ADVANCED_DS_PICKER: 'open_advanced_ds_picker',
  CONFIG_NEW_DS_EMPTY_STATE: 'config_new_ds_empty_state',
  TOGGLE_FAVORITE: 'toggle_favorite',
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

  const listContainerRef = useRef<HTMLDivElement>(null);
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

  const [markerElement, setMarkerElement] = useState<HTMLInputElement | null>();
  const [footerRef, setFooterRef] = useState<HTMLElement | null>();
  const currentDataSourceInstanceSettings = useDatasource(current);
  const currentValue = Boolean(!current && noDefault) ? undefined : currentDataSourceInstanceSettings;
  const prefixIcon =
    filterTerm && isOpen ? <DataSourceLogoPlaceHolder /> : <DataSourceLogo dataSource={currentValue} />;

  const dataSources = useDatasources({
    alerting: props.alerting,
    annotations: props.annotations,
    dashboard: props.dashboard,
    logs: props.logs,
    metrics: props.metrics,
    mixed: props.mixed,
    pluginId: props.pluginId,
    tracing: props.tracing,
    type: props.type,
    variables: props.variables,
  });

  const favoriteDataSources = useFavoriteDatasources();
  const placement = 'bottom-start';

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
    ...floatingUtils.getPositioningMiddleware(placement),
  ];

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement,
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
      onClose,
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

  function getFocusableListItems(): HTMLElement[] {
    if (!listContainerRef.current) {
      return [];
    }
    return Array.from(
      listContainerRef.current.querySelectorAll<HTMLElement>(
        'button, [role="option"], [role="listitem"] [tabindex="0"]'
      )
    ).filter((el) => el.offsetParent !== null);
  }

  function transferFocusToList(direction: 'down' | 'up') {
    setTimeout(() => {
      const items = getFocusableListItems();
      if (items.length === 0) {
        return;
      }
      const target = direction === 'down' ? items[0] : items[items.length - 1];
      target.focus();
    }, 0);
  }

  function onKeyDownInput(keyEvent: React.KeyboardEvent<HTMLInputElement>) {
    switch (keyEvent.key) {
      case 'ArrowDown':
        keyEvent.preventDefault();
        if (!isOpen) {
          setOpen(true);
        }
        transferFocusToList('down');
        break;

      case 'ArrowUp':
        keyEvent.preventDefault();
        if (!isOpen) {
          setOpen(true);
        }
        transferFocusToList('up');
        break;

      case 'Enter':
        keyEvent.preventDefault();
        if (!isOpen) {
          setOpen(true);
        }
        transferFocusToList('down');
        break;

      case 'Tab':
        if (isOpen) {
          if (!keyEvent.shiftKey) {
            keyEvent.preventDefault();
            footerRef?.focus();
          } else {
            onClose();
          }
        }
        break;

      case 'Escape':
        if (isOpen) {
          onClose();
        }
        break;
    }
  }

  function onKeyDownList(keyEvent: React.KeyboardEvent<HTMLDivElement>) {
    switch (keyEvent.key) {
      case 'ArrowDown': {
        keyEvent.preventDefault();
        const items = getFocusableListItems();
        const currentIdx = items.findIndex((el) => el === document.activeElement);
        const next = items[currentIdx + 1];
        if (next) {
          next.focus();
          // Scroll the newly focused item into view inside the ScrollContainer
          next.scrollIntoView({ block: 'nearest' });
        }
        break;
      }

      case 'ArrowUp': {
        keyEvent.preventDefault();
        const items = getFocusableListItems();
        const currentIdx = items.findIndex((el) => el === document.activeElement);
        if (currentIdx <= 0) {
          // At the top — return focus to the search input
          markerElement?.focus();
        } else {
          const prev = items[currentIdx - 1];
          if (prev) {
            prev.focus();
            prev.scrollIntoView({ block: 'nearest' });
          }
        }
        break;
      }

      case 'Escape':
        keyEvent.preventDefault();
        onClose();
        break;

      case 'Tab':
        if (!keyEvent.shiftKey) {
          keyEvent.preventDefault();
          footerRef?.focus();
        } else {
          keyEvent.preventDefault();
          markerElement?.focus();
        }
        break;
    }
  }

  function onNavigateOutsideFooter(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.shiftKey) {
      e.preventDefault();
      transferFocusToList('up');
    } else {
      onClose();
    }
  }

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
            total_configured: dataSources.length,
          });
        }}
      >
        <Input
          id={inputId || 'data-source-picker'}
          className={inputHasFocus ? undefined : styles.input}
          data-testid={selectors.components.DataSourcePicker.inputV2}
          aria-label={t('datasources.data-source-picker.aria-label-select-a-data-source', 'Select a data source')}
          autoComplete="off"
          prefix={currentValue ? prefixIcon : undefined}
          suffix={<Icon name={isOpen ? 'search' : 'angle-down'} />}
          placeholder={hideTextValue ? '' : dataSourceLabel(currentValue) || placeholder}
          onFocus={() => setInputHasFocus(true)}
          onBlur={() => setInputHasFocus(false)}
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
        />
      </div>

      {isOpen ? (
        <Portal>
          <div {...underlayProps} />
          <div ref={ref} {...overlayProps} {...dialogProps}>
            <PickerContent
              {...restProps}
              style={floatingStyles}
              ref={refs.setFloating}
              listContainerRef={listContainerRef}
              footerRef={setFooterRef}
              current={currentValue}
              filterTerm={filterTerm}
              onKeyDownList={onKeyDownList}
              onChange={(ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => {
                onClose();
                if (ds.uid !== currentValue?.uid) {
                  onChange(ds, defaultQueries);
                  reportInteraction(INTERACTION_EVENT_NAME, {
                    item: INTERACTION_ITEM.SELECT_DS,
                    ds_type: ds.type,
                    is_favorite: favoriteDataSources.enabled
                      ? favoriteDataSources.isFavoriteDatasource(ds.uid)
                      : undefined,
                  });
                }
              }}
              onClose={onClose}
              onDismiss={onClose}
              onNavigateOutsideFooter={onNavigateOutsideFooter}
              dataSources={dataSources}
              favoriteDataSources={favoriteDataSources}
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
  style: React.CSSProperties;
  filterTerm?: string;
  onClose: () => void;
  onDismiss: () => void;
  footerRef: (element: HTMLElement | null) => void;
  listContainerRef: React.RefObject<HTMLDivElement>;
  onKeyDownList: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onNavigateOutsideFooter: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  dataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  favoriteDataSources: FavoriteDatasources;
}

const PickerContent = React.forwardRef<HTMLDivElement, PickerContentProps>((props, ref) => {
  const { filterTerm, onChange, current, filter, dataSources, favoriteDataSources, listContainerRef, onKeyDownList } =
    props;

  const changeCallback = useCallback(
    (ds: DataSourceInstanceSettings) => {
      onChange(ds);
    },
    [onChange]
  );

  const styles = useStyles2(getStylesPickerContent);

  return (
    <div style={props.style} ref={ref} className={styles.container}>
      {/*
        listContainerRef wraps the ScrollContainer so getFocusableListItems()
        only queries inside the scrollable list, not the footer.
        onKeyDownList intercepts arrow keys here so focus moves between items
        instead of the browser scrolling the page.
        ScrollContainer is INSIDE the ref div so it still clips to maxHeight
        set by the floating-ui size middleware — giving the original 4-item
        visible / scroll-for-more behaviour.
      */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- key-event delegation wrapper for list, not a focusable control */}
      <div ref={listContainerRef} onKeyDown={onKeyDownList} className={styles.listWrapper}>
        <ScrollContainer showScrollIndicators>
          <DataSourceList
            {...props}
            favoriteDataSources={favoriteDataSources}
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
            dataSources={dataSources}
          />
        </ScrollContainer>
      </div>
      <FocusScope>
        <Footer {...props} onChange={changeCallback} onNavigateOutsideFooter={props.onNavigateOutsideFooter} />
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
    listWrapper: css({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
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

function Footer({ onClose, onChange, ...props }: FooterProps) {
  const styles = useStyles2(getStylesFooter);

  const onKeyDownLastButton = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Tab') {
      props.onNavigateOutsideFooter(e);
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
                current: props.current,
                onDismiss: hideModal,
                onChange: (ds, defaultQueries) => {
                  onChange(ds, defaultQueries);
                  hideModal();
                },
                dataSources: props.dataSources,
              });
              reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.OPEN_ADVANCED_DS_PICKER });
            }}
            ref={props.footerRef}
            onKeyDown={onKeyDownLastButton}
          >
            <Trans i18nKey="data-source-picker.open-advanced-button">Open advanced data source picker</Trans>
            <Icon name="arrow-right" />
          </Button>
        )}
      </ModalsController>
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
