import { isString } from 'lodash';
import { useState } from 'react';

import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Drawer } from '../Drawer/Drawer';
import { Stack } from '../Layout/Stack/Stack';
import { CodeEditor } from '../Monaco/CodeEditor';
import { Tab, TabsBar } from '../Tabs';

export enum TableCellInspectorMode {
  code = 'code',
  text = 'text',
}

interface TableCellInspectorProps {
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
        displayValue = JSON.stringify(value, null, '');
      } catch {}
    }
  } else {
    displayValue = JSON.stringify(value, null, '');
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
    <Drawer onClose={onDismiss} title="Inspect value" tabs={tabBar}>
      <Stack direction="column" gap={2}>
        <ClipboardButton icon="copy" getText={() => text} style={{ marginLeft: 'auto', width: '200px' }}>
          Copy to Clipboard
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
