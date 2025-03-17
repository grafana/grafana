import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { RadioButtonDot, Stack, useStyles2, Text } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { layoutRegistry } from './layoutRegistry';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function DashboardLayoutSelector({ layoutManager }: Props) {
  const isGridLayout = layoutManager.descriptor.isGridLayout;
  const options = layoutRegistry.list().filter((layout) => layout.isGridLayout === isGridLayout);

  const styles = useStyles2(getStyles);

  return (
    <div role="radiogroup" className={styles.radioGroup}>
      {options.map((opt) => {
        switch (opt.id) {
          case 'rows-layout':
            return (
              <LayoutRadioButton
                label={opt.name}
                id={opt.id}
                description={opt.description!}
                isSelected={layoutManager.descriptor.id === opt.id}
                onSelect={() => changeLayoutTo(layoutManager, opt)}
              >
                <div className={styles.rowsLayoutViz}>
                  {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
                  <div style={{ gridColumn: 'span 3', fontSize: '6px' }}>⌄ &nbsp; .-.-.-.-.-</div>
                  <GridCell />
                  <GridCell />
                  <GridCell />
                  {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
                  <div style={{ gridColumn: 'span 3', fontSize: '6px' }}>⌄ &nbsp; .-.-.-.-.-</div>
                  <GridCell />
                  <GridCell />
                  <GridCell />
                </div>
              </LayoutRadioButton>
            );
          case 'tabs-layout':
            return (
              <LayoutRadioButton
                label={opt.name}
                id={opt.id}
                description={opt.description!}
                isSelected={layoutManager.descriptor.id === opt.id}
                onSelect={() => changeLayoutTo(layoutManager, opt)}
              >
                <Stack direction="column" gap={0.5} height={'100%'}>
                  <div className={styles.tabsBar}>
                    {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
                    <div className={cx(styles.tab, styles.tabActive)}>-.-.-</div>
                    {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
                    <div className={styles.tab}>-.-.-</div>
                    {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
                    <div className={styles.tab}>-.-.-</div>
                  </div>
                  <div className={styles.tabsVizTabContent}>
                    <GridCell />
                    <GridCell />
                  </div>
                </Stack>
              </LayoutRadioButton>
            );
          case 'responsive-grid':
            return (
              <LayoutRadioButton
                label={opt.name}
                id={opt.id}
                description={opt.description!}
                isSelected={layoutManager.descriptor.id === opt.id}
                onSelect={() => changeLayoutTo(layoutManager, opt)}
              >
                <div className={styles.autoGridViz}>
                  <GridCell />
                  <GridCell />
                  <GridCell />
                  <GridCell />
                </div>
              </LayoutRadioButton>
            );
          case 'custom-grid':
          default:
            return (
              <LayoutRadioButton
                label={opt.name}
                id={opt.id}
                description={opt.description!}
                isSelected={layoutManager.descriptor.id === opt.id}
                onSelect={() => changeLayoutTo(layoutManager, opt)}
              >
                <div className={styles.customGridViz}>
                  <GridCell colSpan={2} />
                  <div className={styles.customGridVizInner}>
                    <GridCell />
                    <GridCell />
                  </div>
                  <GridCell />
                  <GridCell colSpan={2} />
                </div>
              </LayoutRadioButton>
            );
        }
      })}
    </div>
  );
}

interface LayoutRadioButtonProps {
  label: string;
  id: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}

function LayoutRadioButton({ label, id, description, isSelected, children, onSelect }: LayoutRadioButtonProps) {
  const styles = useStyles2(getStyles);

  return (
    // This outer div is just so that the radio dot can be outside the
    // label (as the RadioButtonDot has a label element and they can't nest)
    <div className={styles.radioButtonOuter}>
      <label
        htmlFor={`layout-${id}`}
        tabIndex={0}
        className={cx(styles.radioButton, isSelected && styles.radioButtonActive)}
      >
        {children}
        <Stack direction="column" gap={1} justifyContent="space-between" grow={1}>
          <Text weight="medium">{label}</Text>
          <Text variant="bodySmall" color="secondary">
            {description}
          </Text>
        </Stack>
      </label>
      <div className={styles.radioDot}>
        <RadioButtonDot id={`layout-${id}`} name={'layout'} label={<></>} onChange={onSelect} checked={isSelected} />
      </div>
    </div>
  );
}

function GridCell({ colSpan = 1 }: { colSpan?: number }) {
  const styles = useStyles2(getStyles);

  return <div className={styles.gridCell} style={{ gridColumn: `span ${colSpan}` }}></div>;
}

export function useLayoutCategory(layoutManager: DashboardLayoutManager) {
  return useMemo(() => {
    const categoryName = layoutManager.descriptor.isGridLayout
      ? t('dashboard.layout.common.grid', 'Grid')
      : t('dashboard.layout.common.layout', 'Layout');

    const layoutCategory = new OptionsPaneCategoryDescriptor({
      title: categoryName,
      id: 'layout-options',
      isOpenDefault: true,
    });

    layoutCategory.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        skipField: true,
        render: () => <DashboardLayoutSelector layoutManager={layoutManager} />,
      })
    );

    if (layoutManager.getOptions) {
      for (const option of layoutManager.getOptions()) {
        layoutCategory.addItem(option);
      }
    }

    return layoutCategory;
  }, [layoutManager]);
}

function changeLayoutTo(currentLayout: DashboardLayoutManager, newLayoutDescriptor: LayoutRegistryItem) {
  const layoutParent = currentLayout.parent;
  if (layoutParent && isLayoutParent(layoutParent)) {
    layoutParent.switchLayout(newLayoutDescriptor.createFromLayout(currentLayout));
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    radioButtonOuter: css({
      position: 'relative',
    }),
    radioDot: css({
      position: 'absolute',
      top: theme.spacing(0.5),
      right: theme.spacing(0),
    }),
    radioGroup: css({
      backgroundColor: theme.colors.background.primary,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(2),
    }),
    radioButton: css({
      alignItems: 'flex-start',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1),
      border: `1px solid ${theme.colors.border.weak}`,
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      display: 'grid',
      gridTemplateColumns: `80px 1fr`,
      gridTemplateRows: '70px',
    }),
    radioButtonActive: css({
      border: `1px solid ${theme.colors.primary.border}`,
    }),
    gridCell: css({
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
    }),
    tab: css({
      width: theme.spacing(2),
      height: theme.spacing(1),
      fontSize: '5px',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      justifyContent: 'center',
    }),
    tabActive: css({
      '&:before': {
        content: '" "',
        position: 'absolute',
        height: 1,
        bottom: 0,
        left: 0,
        right: 0,
        background: theme.colors.gradients.brandHorizontal,
      },
    }),
    tabsBar: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      borderBottom: `1px solid ${theme.colors.border.medium}`,
    }),
    rowsLayoutViz: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: '10px 1fr 10px 1fr',
      gap: '4px',
      height: '100%',
    }),
    tabsVizTabContent: css({
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr',
      gap: '4px',
      flexGrow: 1,
    }),
    autoGridViz: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gridTemplateRows: 'repeat(2, 1fr)',
      gap: '4px',
      height: '100%',
    }),
    customGridViz: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(2, 1fr)',
      gap: '4px',
      height: '100%',
    }),
    customGridVizInner: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(1, 1fr)',
      gridTemplateRows: 'repeat(2, 1fr)',
      gap: '4px',
    }),
  };
};
