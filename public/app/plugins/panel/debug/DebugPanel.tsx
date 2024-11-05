import { useMemo, useState } from 'react';

import { PanelProps, SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { ComboBox } from './ComboBox';
import { ReactWindow } from './ReactWindow';
import { ReactWindowNativeScroll } from './ReactWindowNativeScroll';
import { SelectThing } from './SelectThing';
import { Options } from './panelcfg.gen';

type Props = PanelProps<Options>;

const randStr = (len = 7) => Math.random().toString(36).slice(-len);

const radioOpts: SelectableValue[] = [
  { label: 'Nothing', value: 'nothing' },
  { label: 'Select', value: 'select' },
  { label: 'Combobox', value: 'combobox' },
  { label: 'react-window', value: 'reactwindow' },
  { label: 'react-window-native', value: 'reactwindow2' },
];

const genData = (length = 200_000) => {
  console.time('gen options');

  let list = Array.from({ length }, (_, i) => `${i + 1}: ${randStr()}`);
  let opts = list.map((v) => ({ label: v, value: v }));

  console.timeEnd('gen options');

  return { list, opts };
};

export const DebugPanel = (props: Props) => {
  const [selected, setSelected] = useState('nothing');

  const { list, opts } = useMemo(
    () => genData(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.data]
  );

  return (
    <>
      <div>
        <RadioButtonGroup options={radioOpts} value={selected} onChange={setSelected} />
      </div>
      {selected === 'select' && <SelectThing data={opts} />}
      {selected === 'combobox' && <ComboBox data={opts} />}
      {selected === 'reactwindow' && <ReactWindow data={list} />}
      {selected === 'reactwindow2' && <ReactWindowNativeScroll data={list} />}
    </>
  );
};
