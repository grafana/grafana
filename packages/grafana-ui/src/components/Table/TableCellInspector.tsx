import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Drawer } from '../Drawer/Drawer';
import { Stack } from '../Layout/Stack/Stack';
import { CodeEditor } from '../Monaco/CodeEditor';
import { Tab } from '../Tabs/Tab';
import { TabsBar } from '../Tabs/TabsBar';

export enum TableCellInspectorMode {
  code = 'code',
  text = 'text',
}

interface TableCellInspectorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: string;
  onDismiss: () => void;
  mode: TableCellInspectorMode;
}

export function TableCellInspector({ value, onDismiss, mode }: TableCellInspectorProps) {
  const [currentMode, setMode] = useState(mode);
  const text = String(value ?? '').trim();
  const styles = useStyles2(getStyles);

  const tabs = [
    {
      label: 'Plain text',
      value: 'text',
    },
    {
      label: 'Code editor',
      value: 'code',
    },
  ];

  const changeTabs = () => {
    setMode(currentMode === TableCellInspectorMode.text ? TableCellInspectorMode.code : TableCellInspectorMode.text);
  };

  const tabBar = (
    <TabsBar>
      {tabs.map((t, index) => (
        <Tab key={`${t.value}-${index}`} label={t.label} active={t.value === currentMode} onChangeTab={changeTabs} />
      ))}
    </TabsBar>
  );

  return (
    <Drawer onClose={onDismiss} title={t('grafana-ui.table.inspect-drawer-title', 'Inspect value')} tabs={tabBar}>
      <Stack direction="column" gap={2}>
        <ClipboardButton icon="copy" getText={() => text} style={{ marginLeft: 'auto', width: '200px' }}>
          <Trans i18nKey="grafana-ui.table.copy">Copy to Clipboard</Trans>
        </ClipboardButton>
        {currentMode === 'code' ? (
          <CodeEditor
            width="100%"
            height={500}
            language="json"
            showLineNumbers={true}
            showMiniMap={(text ? text.length : 0) > 100}
            value={text}
            readOnly={true}
            wordWrap={true}
          />
        ) : (
          <pre className={styles.textContainer}>{text}</pre>
        )}
      </Stack>
    </Drawer>
  );
}

// TODO: should we have different empty styles?
const getStyles = (theme: GrafanaTheme2) => ({
  textContainer: css({
    color: theme.colors.text.secondary,
    minHeight: 42,
  }),
});
