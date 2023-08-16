// import { css } from '@emotion/css';
import React from 'react';

import {
  FieldConfigEditorProps,
  // GrafanaTheme2,
  UnitFieldConfigSettings,
} from '@grafana/data';
import {
  // IconButton,
  UnitPicker,
  // useStyles2,
  Switch,
  Label,
} from '@grafana/ui';

type UnitValue = {
  type: string;
  scalable: boolean;
};

type Props = FieldConfigEditorProps<UnitValue, UnitFieldConfigSettings>;

export function UnitValueEditor({ value, onChange, item }: Props) {
  // const [scalable, setScalable] = useState(true);

  // const styles = useStyles2(getStyles);

  // if (item?.settings?.isClearable && value != null) {
  //   return (
  //     <div className={styles.wrapper}>
  //       <span className={styles.first}>
  //         <UnitPicker value={value}
  //           onChange={() => onChange({ type: value, scalable })}
  //         />
  //       </span>
  //       <IconButton name="times" onClick={() => onChange(undefined)} tooltip="Clear unit selection" />
  //     </div>
  //   );
  // }
  return (
    <>
      <UnitPicker value={value?.type} onChange={onChange} scalable={value.scalable} />
      <div style={{ marginTop: '16px' }}>
        <Label>Scalable</Label>
        <Switch
          value={value.scalable}
          id="scalable"
          onChange={() => onChange({ type: value.type, scalable: !value.scalable })}
        />
      </div>
    </>
  );
}

// const getStyles = (theme: GrafanaTheme2) => ({
//   wrapper: css`
//     width: 100%;
//     display: flex;
//     flex-direction: rows;
//     align-items: center;
//   `,
//   first: css`
//     margin-right: 8px;
//     flex-grow: 2;
//   `,
// });
