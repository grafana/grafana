import React from 'react';
import { Segment, SegmentInput } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

type FieldEditorProps = {
  name: string;
  value?: string;
  options: string[];
  styles: { [name in 'segment' | 'input']: string };
  onChange: (value: string) => void;
  onExpandedChange: (expanded: boolean) => void;
};

function mapOptions(options: string[]): Array<SelectableValue<string>> {
  return (options || []).map((option: string) => {
    return {
      value: option,
      label: option,
    };
  });
}

export function FieldEditor({
  name,
  value = undefined,
  options,
  styles,
  onChange,
  onExpandedChange,
}: FieldEditorProps) {
  if (options?.length > 0) {
    return (
      <Segment
        value={value}
        className={styles.segment}
        options={mapOptions(options)}
        placeholder={' +' + name}
        onChange={(value) => {
          onChange(value.value || '');
        }}
        onExpandedChange={onExpandedChange}
        inputMinWidth={100}
        allowCustomValue={true}
      ></Segment>
    );
  } else {
    return (
      <SegmentInput
        className={styles.input}
        value={value || ''}
        placeholder={' +' + name}
        onChange={(value) => {
          onChange(value.toString());
        }}
        onExpandedChange={onExpandedChange}
        inputMinWidth={100}
        style={{ height: '28px', paddingTop: '2px', paddingLeft: '4px', fontSize: '12px' }}
      ></SegmentInput>
    );
  }
}
