import { css } from '@emotion/css';
import { Fragment, type JSX } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { AccessoryButton } from '@grafana/plugin-ui';
import { InlineLabel, useStyles2 } from '@grafana/ui';

import { toSelectableValue } from '../utils/toSelectableValue';
import { unwrap } from '../utils/unwrap';

import { AddButton } from './AddButton';
import { Seg } from './Seg';

export type PartParams = Array<{
  value: string;
  options: (() => Promise<string[]>) | null;
}>;

type Props = {
  parts: Array<{
    name: string;
    params: PartParams;
  }>;
  getNewPartOptions: () => Promise<SelectableValue[]>;
  onChange: (partIndex: number, paramValues: string[]) => void;
  onRemovePart: (index: number) => void;
  onAddNewPart: (type: string) => void;
};

type PartProps = {
  name: string;
  params: PartParams;
  onChange: (paramValues: string[]) => void;
};

const getStyles = (theme: GrafanaTheme2) => ({
  part: css({
    paddingLeft: 0,
    paddingRight: 0,
    marginLeft: 0,
    marginRight: 0,
    lineHeight: theme.typography.body.lineHeight,
    fontSize: theme.typography.body.fontSize,
  }),
  name: css({
    paddingRight: 0,
    marginRight: 0,
  }),
  segmentButton: css({
    paddingLeft: 0,
    paddingRight: 0,
    marginLeft: 0,
    marginRight: 0,
  }),
});

const Part = ({ name, params, onChange }: PartProps): JSX.Element => {
  const styles = useStyles2(getStyles);

  const onParamChange = (par: string, i: number) => {
    const newParams = params.map((p) => p.value);
    newParams[i] = par;
    onChange(newParams);
  };
  return (
    <InlineLabel as="div" width="auto" className={styles.part}>
      <InlineLabel as="span" width="auto" className={styles.name}>
        {name}
      </InlineLabel>
      (
      {params.map((p, i) => {
        const { value, options } = p;
        const isLast = i === params.length - 1;
        const loadOptions =
          options !== null ? () => options().then((items) => items.map(toSelectableValue)) : undefined;
        return (
          <Fragment key={i}>
            <Seg
              allowCustomValue
              value={value}
              buttonClassName={styles.segmentButton}
              loadOptions={loadOptions}
              onChange={(v) => {
                onParamChange(unwrap(v.value), i);
              }}
            />
            {!isLast && ','}
          </Fragment>
        );
      })}
      )
    </InlineLabel>
  );
};

export const PartListSection = ({
  parts,
  getNewPartOptions,
  onAddNewPart,
  onRemovePart,
  onChange,
}: Props): JSX.Element => {
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          <Part
            name={part.name}
            params={part.params}
            onChange={(pars) => {
              onChange(index, pars);
            }}
          />
          <AccessoryButton
            style={{ marginRight: '4px' }}
            aria-label={`Remove ${part.name}`}
            icon="times"
            variant="secondary"
            onClick={() => {
              onRemovePart(index);
            }}
          />
        </Fragment>
      ))}
      <AddButton loadOptions={getNewPartOptions} onAdd={onAddNewPart} />
    </>
  );
};
