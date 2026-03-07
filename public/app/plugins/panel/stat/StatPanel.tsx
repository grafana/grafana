import { css, cx } from '@emotion/css';
import { isNumber } from 'lodash';
import { memo, useCallback, useEffect, useRef, useState, type JSX } from 'react';

import {
  CoreApp,
  DisplayValueAlignmentFactors,
  FieldDisplay,
  FieldType,
  GrafanaTheme2,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  NumericRange,
  PanelProps,
} from '@grafana/data';
import { findNumericFieldMinMax } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { BigValueColorMode, BigValueGraphMode, BigValueTextMode } from '@grafana/schema';
import {
  BigValue,
  DataLinksContextMenu,
  IconButton,
  Popover,
  Select,
  Stack,
  Text,
  usePanelContext,
  useTheme2,
  VizRepeater,
  VizRepeaterRenderValueProps,
} from '@grafana/ui';
import { DataLinksContextMenuApi } from '@grafana/ui/internal';

import { Options } from './panelcfg.gen';

// PoC: this flag is injected by Scenes dashboard via `setDashboardPanelContext`.
// It should become a real `PanelContext` field if we turn this into a feature.
interface PanelContextWithDashboardEditing {
  isDashboardEditing?: boolean;
}

function hasScenesDashboardEditingFlag(v: unknown): v is PanelContextWithDashboardEditing {
  return typeof v === 'object' && v !== null && 'isDashboardEditing' in v;
}

export const StatPanel = memo(
  ({
    timeRange,
    options,
    fieldConfig,
    title,
    data,
    replaceVariables,
    timeZone,
    height,
    width,
    renderCounter,
    onOptionsChange,
  }: PanelProps<Options>) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    const panelContext = usePanelContext();
    const isDashboardEditing = hasScenesDashboardEditingFlag(panelContext)
      ? Boolean(panelContext.isDashboardEditing)
      : false;
    const isEditing = panelContext.app === CoreApp.PanelEditor || isDashboardEditing;

    const [isPopoverVisible, setPopoverVisible] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverContentRef = useRef<HTMLDivElement>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dragStartRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);

    const textModeOptions = [
      { value: BigValueTextMode.Auto, label: t('stat.inline.textMode.auto', 'Auto') },
      { value: BigValueTextMode.Value, label: t('stat.inline.textMode.value', 'Value') },
      { value: BigValueTextMode.ValueAndName, label: t('stat.inline.textMode.valueAndName', 'Value and name') },
      { value: BigValueTextMode.Name, label: t('stat.inline.textMode.name', 'Name') },
      { value: BigValueTextMode.None, label: t('stat.inline.textMode.none', 'None') },
    ];

    const colorModeOptions = [
      { value: BigValueColorMode.None, label: t('stat.inline.colorMode.none', 'None') },
      { value: BigValueColorMode.Value, label: t('stat.inline.colorMode.value', 'Value') },
      {
        value: BigValueColorMode.Background,
        label: t('stat.inline.colorMode.backgroundGradient', 'Background gradient'),
      },
      {
        value: BigValueColorMode.BackgroundSolid,
        label: t('stat.inline.colorMode.backgroundSolid', 'Background solid'),
      },
    ];

    const getTextMode = useCallback(() => {
      // If we have manually set displayName or panel title switch text mode to value and name
      if (options.textMode === BigValueTextMode.Auto && (fieldConfig.defaults.displayName || !title)) {
        return BigValueTextMode.ValueAndName;
      }

      return options.textMode;
    }, [options.textMode, fieldConfig.defaults.displayName, title]);

    const renderComponent = useCallback(
      (
        valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>,
        menuProps: DataLinksContextMenuApi
      ): JSX.Element => {
        const { value, alignmentFactors, width, height, count } = valueProps;
        const { openMenu, targetClassName } = menuProps;
        let sparkline = value.sparkline;
        if (sparkline) {
          sparkline.timeRange = timeRange;
        }

        return (
          <BigValue
            value={value.display}
            count={count}
            sparkline={sparkline}
            colorMode={options.colorMode}
            graphMode={options.graphMode}
            justifyMode={options.justifyMode}
            textMode={getTextMode()}
            alignmentFactors={alignmentFactors}
            text={options.text}
            width={width}
            height={height}
            theme={theme}
            onClick={openMenu}
            className={targetClassName}
            disableWideLayout={!options.wideLayout}
            percentChangeColorMode={options.percentChangeColorMode}
          />
        );
      },
      [theme, timeRange, options, getTextMode]
    );

    const renderValue = useCallback(
      (valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>): JSX.Element => {
        const { value } = valueProps;
        const { getLinks, hasLinks } = value;

        if (hasLinks && getLinks) {
          return (
            <DataLinksContextMenu links={getLinks}>
              {(api) => {
                return renderComponent(valueProps, api);
              }}
            </DataLinksContextMenu>
          );
        }

        return renderComponent(valueProps, {});
      },
      [renderComponent]
    );

    const getValues = useCallback((): FieldDisplay[] => {
      let globalRange: NumericRange | undefined = undefined;

      for (let frame of data.series) {
        for (let field of frame.fields) {
          let { config } = field;
          // mostly copied from fieldOverrides, since they are skipped during streaming
          // Set the Min/Max value automatically
          if (field.type === FieldType.number) {
            if (field.state?.range) {
              continue;
            }
            if (!globalRange && (!isNumber(config.min) || !isNumber(config.max))) {
              globalRange = findNumericFieldMinMax(data.series);
            }
            const min = config.min ?? globalRange!.min;
            const max = config.max ?? globalRange!.max;
            field.state = field.state ?? {};
            field.state.range = { min, max, delta: max! - min! };
          }
        }
      }

      return getFieldDisplayValues({
        fieldConfig,
        reduceOptions: options.reduceOptions,
        replaceVariables,
        theme,
        data: data.series,
        sparkline: options.graphMode !== BigValueGraphMode.None,
        percentChange: options.showPercentChange,
        timeZone,
      });
    }, [data, fieldConfig, theme, options, replaceVariables, timeZone]);

    // Close the quick-edit popover on outside click / Escape.
    useEffect(() => {
      if (!isPopoverVisible) {
        return;
      }

      const onPointerDown = (e: PointerEvent) => {
        const target = e.target;
        if (!(target instanceof Node)) {
          return;
        }

        // react-select menus are rendered outside this popover (portal). Don't treat those clicks as "outside".
        // Also ignore interactions with the select control itself.
        const targetEl = target instanceof Element ? target : target instanceof Text ? target.parentElement : null;
        // Ignore react-select interactions (menu is portaled, and options are clickable).
        // Use roles instead of class selectors to avoid tying to deprecated gf-form classnames.
        if (targetEl && targetEl.closest('[role="listbox"], [role="combobox"]')) {
          return;
        }

        if (triggerRef.current?.contains(target)) {
          return;
        }

        if (popoverContentRef.current?.contains(target)) {
          return;
        }

        setPopoverVisible(false);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setPopoverVisible(false);
        }
      };

      window.addEventListener('pointerdown', onPointerDown, { capture: true });
      window.addEventListener('keydown', onKeyDown, { capture: true });
      return () => {
        window.removeEventListener('pointerdown', onPointerDown, { capture: true });
        window.removeEventListener('keydown', onKeyDown, { capture: true });
      };
    }, [isPopoverVisible]);

    // Drag handling for the quick edit "window"
    useEffect(() => {
      const onPointerMove = (e: PointerEvent) => {
        const s = dragStartRef.current;
        if (!s) {
          return;
        }
        setDragOffset({
          x: s.baseX + (e.clientX - s.x),
          y: s.baseY + (e.clientY - s.y),
        });
      };

      const onPointerUp = () => {
        dragStartRef.current = null;
      };

      window.addEventListener('pointermove', onPointerMove, { capture: true });
      window.addEventListener('pointerup', onPointerUp, { capture: true });
      return () => {
        window.removeEventListener('pointermove', onPointerMove, { capture: true });
        window.removeEventListener('pointerup', onPointerUp, { capture: true });
      };
    }, []);

    return (
      <div className={styles.root}>
        {isEditing && (
          <div
            className={cx(styles.inlineControls, 'grid-drag-cancel', 'show-on-hover')}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconButton
              ref={triggerRef}
              name="sliders-v-alt"
              tooltip={t('stat.inline.quickEdit.tooltip', 'Quick edit')}
              onClick={(e) => {
                e.stopPropagation();
                setDragOffset({ x: 0, y: 0 });
                setPopoverVisible((v) => !v);
              }}
            />

            {isPopoverVisible && triggerRef.current && (
              <Popover
                referenceElement={triggerRef.current}
                placement="bottom-end"
                show
                content={
                  <div
                    className={styles.popoverContent}
                    ref={popoverContentRef}
                    style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
                  >
                    <Stack direction="column" gap={1}>
                      <div
                        className={styles.popoverHeader}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          // Left button / primary pointer only
                          if (e.button !== 0) {
                            return;
                          }
                          dragStartRef.current = {
                            x: e.clientX,
                            y: e.clientY,
                            baseX: dragOffset.x,
                            baseY: dragOffset.y,
                          };
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                          <Stack direction="column" gap={0}>
                            <Text variant="body" weight="medium">
                              {t('stat.inline.quickEdit.title', 'Quick edit')}
                            </Text>
                            <Text variant="bodySmall" color="secondary" truncate title={title || undefined}>
                              {title
                                ? t('stat.inline.quickEdit.panelTitle', 'Stat: {{title}}', { title })
                                : t('stat.inline.quickEdit.panelTitle.untitled', 'Stat: Untitled')}
                            </Text>
                          </Stack>
                          <IconButton
                            name="times"
                            size="sm"
                            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                            aria-label="Close"
                            onClick={() => setPopoverVisible(false)}
                          />
                        </Stack>
                      </div>

                      <div className={styles.popoverDivider} />

                      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                        <Text variant="bodySmall" weight="medium">
                          {t('stat.inline.quickEdit.textMode', 'Text mode')}
                        </Text>
                        <Select
                          width={22}
                          value={textModeOptions.find((o) => o.value === options.textMode)}
                          options={textModeOptions}
                          onChange={(v) => v?.value !== undefined && onOptionsChange({ ...options, textMode: v.value })}
                        />
                      </Stack>

                      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                        <Text variant="bodySmall" weight="medium">
                          {t('stat.inline.quickEdit.colorMode', 'Color mode')}
                        </Text>
                        <Select
                          width={22}
                          value={colorModeOptions.find((o) => o.value === options.colorMode)}
                          options={colorModeOptions}
                          onChange={(v) =>
                            v?.value !== undefined && onOptionsChange({ ...options, colorMode: v.value })
                          }
                        />
                      </Stack>
                    </Stack>
                  </div>
                }
              />
            )}
          </div>
        )}

        <VizRepeater
          getValues={getValues}
          getAlignmentFactors={getDisplayValueAlignmentFactors}
          renderValue={renderValue}
          width={width}
          height={height}
          source={data}
          itemSpacing={3}
          renderCounter={renderCounter}
          autoGrid={true}
          orientation={options.orientation}
        />
      </div>
    );
  }
);
StatPanel.displayName = 'StatPanel';

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    position: 'relative',
    width: '100%',
    height: '100%',
  }),
  inlineControls: css({
    position: 'absolute',
    // PoC positioning: align near the panel menu ("...") without taking up space.
    top: theme.spacing(-3.4),
    right: theme.spacing(4.25),
    zIndex: theme.zIndex.dropdown,
    pointerEvents: 'auto',
  }),
  popoverContent: css({
    padding: theme.spacing(1),
    width: '320px',
    // "Liquid glass" PoC styling (VisionOS/macOS-like frosted surface)
    background: theme.isDark ? 'rgba(18, 18, 23, 0.55)' : 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(14px) saturate(180%)',
    WebkitBackdropFilter: 'blur(14px) saturate(180%)',
    border: theme.isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  popoverHeader: css({
    cursor: 'grab',
    userSelect: 'none',
    paddingBottom: theme.spacing(0.5),
    '&:active': {
      cursor: 'grabbing',
    },
  }),
  popoverDivider: css({
    height: 1,
    background: theme.colors.border.weak,
    margin: theme.spacing(0.5, 0),
  }),
});
