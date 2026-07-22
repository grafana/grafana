import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, Field, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { baseThemeOptions } from '../../state/baseThemes';

import { ColorsTab } from './ColorsTab';
import { ComponentsTab } from './ComponentsTab';
import { ExportTab } from './ExportTab';
import { ShapeTab } from './ShapeTab';

type TabId = 'colors' | 'shape' | 'components' | 'export';

interface DesignSidebarProps {
  options: NewThemeOptions;
  derived: GrafanaTheme2;
  baseThemeId: string;
  /** Changes whenever a base theme is loaded, to remount inputs that hold internal state. */
  resetKey: number;
  onLoadBase: (themeId: string) => void;
  onChange: (path: string, value: string | number | undefined) => void;
}

export const DesignSidebar = ({
  options,
  derived,
  baseThemeId,
  resetKey,
  onLoadBase,
  onChange,
}: DesignSidebarProps) => {
  const styles = useStyles2(getStyles);
  const baseSelectId = useId();
  const [activeTab, setActiveTab] = useState<TabId>('colors');

  const renderContent = () => {
    switch (activeTab) {
      case 'colors':
        return <ColorsTab key={resetKey} options={options} derived={derived} onChange={onChange} />;
      case 'shape':
        return <ShapeTab key={resetKey} options={options} derived={derived} onChange={onChange} />;
      case 'components':
        return <ComponentsTab key={resetKey} options={options} derived={derived} onChange={onChange} />;
      case 'export':
        return <ExportTab options={options} />;
      default:
        return null;
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.baseSelector}>
        <Field noMargin label={t('theme-studio.sidebar.base-theme', 'Base theme')}>
          <Combobox
            id={baseSelectId}
            options={baseThemeOptions}
            value={baseThemeId}
            onChange={(option) => onLoadBase(option.value)}
          />
        </Field>
      </div>
      <TabsBar>
        <Tab
          label={t('theme-studio.sidebar.colors', 'Colors')}
          active={activeTab === 'colors'}
          onChangeTab={() => setActiveTab('colors')}
        />
        <Tab
          label={t('theme-studio.sidebar.shape', 'Shape')}
          active={activeTab === 'shape'}
          onChangeTab={() => setActiveTab('shape')}
        />
        <Tab
          label={t('theme-studio.sidebar.components', 'Components')}
          active={activeTab === 'components'}
          onChangeTab={() => setActiveTab('components')}
        />
        <Tab
          label={t('theme-studio.sidebar.export', 'Export')}
          active={activeTab === 'export'}
          onChangeTab={() => setActiveTab('export')}
        />
      </TabsBar>
      <TabContent className={styles.content}>{renderContent()}</TabContent>
    </aside>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  sidebar: css({
    borderRight: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  }),
  baseSelector: css({
    padding: theme.spacing(2, 2, 1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  content: css({
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(2),
  }),
});
