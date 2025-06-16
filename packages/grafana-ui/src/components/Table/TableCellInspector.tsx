import { isString } from 'lodash';
import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';

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
  value: any;
  onDismiss: () => void;
  mode: TableCellInspectorMode;
}

export function TableCellInspector({ value, onDismiss, mode }: TableCellInspectorProps) {
  let displayValue = value;
  const [currentMode, setMode] = useState(mode);

  if (isString(value)) {
    const trimmedValue = value.trim();
    // Exclude numeric strings like '123' from being displayed in code/JSON mode
    if (trimmedValue[0] === '{' || trimmedValue[0] === '[' || mode === 'code') {
      try {
        value = JSON.parse(value);
        displayValue = JSON.stringify(value, null, '  ');
      } catch (error: any) {
        // Display helpful error to help folks diagnose json errors
        console.log(
          'Failed to parse JSON in Table cell inspector (this will cause JSON to not print nicely): ',
          error.message
        );
      }
    }
  } else {
    displayValue = JSON.stringify(value);
  }
  let text = displayValue;

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
            showMiniMap={(text && text.length) > 100}
            value={text}
            readOnly={true}
            wordWrap={true}
          />
        ) : (
          <pre>{text}</pre>
        )}
      </Stack>
    </Drawer>
  );
}
