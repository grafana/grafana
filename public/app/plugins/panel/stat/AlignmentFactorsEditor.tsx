import React, { useCallback } from 'react';
import { Button, Label } from '@grafana/ui';
import { StandardEditorProps, DisplayValueAlignmentFactors, StandardEditorContext } from '@grafana/data';
import { AlignmentFactorLengthEditor } from './AlignmentFactorLengthEditor';

export interface AlignmentFactorsEditorOptions {
  getStandardAlignmentFactors: (ctx: StandardEditorContext<any>) => DisplayValueAlignmentFactors;
}

type Props = StandardEditorProps<DisplayValueAlignmentFactors, any, AlignmentFactorsEditorOptions>;

export const AlignmentFactorsEditor: React.FC<Props> = ({ value, item, context, onChange }) => {
  const onSetExplicit = useCallback(() => {
    const factors = item.settings?.getStandardAlignmentFactors(context);
    onChange(factors ?? { text: '????' });
  }, [onChange, item, context]);

  const onSetAutomatic = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const onFactorsChanged = useCallback(
    (update: Partial<DisplayValueAlignmentFactors>) => {
      onChange({
        ...value,
        ...update,
      });
    },
    [onChange, value]
  );

  if (!value) {
    return (
      <div>
        <Label description="This panel picks font sizes based on the longest strings it needs to display">
          Automatic size factors
        </Label>
        <br />

        <Button onClick={onSetExplicit} variant="secondary" size="md">
          Use explicit factors
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Label description="Font sizes are picked based on the expected display value lenghts.">
        Explicit size factors
      </Label>
      <br />

      <Label>Title length</Label>
      <AlignmentFactorLengthEditor value={value.title} onChange={v => onFactorsChanged({ title: v })} />
      <Label>Text length</Label>
      <AlignmentFactorLengthEditor value={value.text} onChange={v => onFactorsChanged({ text: v })} />
      <Label>Prefix length</Label>
      <AlignmentFactorLengthEditor value={value.prefix} onChange={v => onFactorsChanged({ prefix: v })} />
      <Label>Suffix length</Label>
      <AlignmentFactorLengthEditor value={value.suffix} onChange={v => onFactorsChanged({ suffix: v })} />
      <br />
      <Button onClick={onSetAutomatic} variant="secondary" size="md">
        Use automatic factors
      </Button>
    </div>
  );
};
