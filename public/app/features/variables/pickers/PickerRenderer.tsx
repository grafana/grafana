import { PropsWithChildren, ReactElement, useMemo } from 'react';

import { TypedVariableModel, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Stack } from '@grafana/ui';

import { variableAdapters } from '../adapters';
import { VARIABLE_PREFIX } from '../constants';

import { VariableDescriptionInfoIcon } from './shared/VariableDescriptionInfoIcon';

interface Props {
  variable: TypedVariableModel;
  readOnly?: boolean;
}

export const PickerRenderer = (props: Props) => {
  const PickerToRender = useMemo(() => variableAdapters.get(props.variable.type).picker, [props.variable]);

  if (!props.variable) {
    return (
      <div>
        <Trans i18nKey="variables.picker-renderer.couldnt-load-variable">Couldn't load variable</Trans>
      </div>
    );
  }

  return (
    <Stack gap={0}>
      <PickerLabel variable={props.variable} />
      {props.variable.hide !== VariableHide.hideVariable && PickerToRender && (
        <PickerToRender variable={props.variable} readOnly={props.readOnly ?? false} />
      )}
    </Stack>
  );
};

function PickerLabel({ variable }: PropsWithChildren<Props>): ReactElement | null {
  const labelOrName = useMemo(() => variable.label || variable.name, [variable]);

  if (variable.hide !== VariableHide.dontHide) {
    return null;
  }

  const elementId = VARIABLE_PREFIX + variable.id;
  if (variable.description) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <label
          className="gf-form-label gf-form-label--variable"
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
          htmlFor={elementId}
        >
          {labelOrName}
        </label>
        <VariableDescriptionInfoIcon
          description={variable.description}
          docsUrl={variable.docsUrl}
          label={typeof labelOrName === 'string' ? labelOrName : variable.name}
        />
      </span>
    );
  }

  return (
    <label
      className="gf-form-label gf-form-label--variable"
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
      htmlFor={elementId}
    >
      {labelOrName}
    </label>
  );
}
