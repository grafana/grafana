import { PropsWithChildren, ReactElement, useMemo } from 'react';

import { QueryVariableModel, TypedVariableModel, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Stack, Tooltip } from '@grafana/ui';

import { FEATURE_CONST, getFeatureStatus } from '../../dashboard/services/featureFlagSrv';
import { variableAdapters } from '../adapters';
import { VARIABLE_PREFIX } from '../constants';

interface Props {
  variable: TypedVariableModel;
  readOnly?: boolean;
  onRefresh?: (variable: QueryVariableModel) => void; // BMC code
}

// BMC code starts
function isCachingEnabledForVariables(queryVar: QueryVariableModel): boolean {
  if (!queryVar) {
    return false;
  }
  if (queryVar?.bmcVarCache) {
    return true;
  }
  return false;
}
// BMC code ends

export const PickerRenderer = (props: Props) => {
  const { variable, readOnly, onRefresh } = props;

  const PickerToRender = useMemo(() => variableAdapters.get(variable.type).picker, [variable.type]);
  // BMC code starts
  const isCachingEnabled = useMemo(() => {
    if (variable.type !== 'query') {
      return false;
    }
    return isCachingEnabledForVariables(variable as QueryVariableModel);
  }, [variable]);
  // BMC code ends
  return (
    <Stack gap={0}>
      <PickerLabel variable={variable} />
      {variable.hide !== VariableHide.hideVariable && PickerToRender && (
        <PickerToRender variable={variable} readOnly={readOnly ?? false} />
      )}
      {/* BMC code starts */}
      {getFeatureStatus(FEATURE_CONST.BHD_ENABLE_VAR_CACHING) &&
        variable.type === 'query' &&
        isCachingEnabled &&
        variable.hide !== VariableHide.hideVariable &&
        onRefresh && (
          <Tooltip content="Refresh this variable" placement="bottom">
            <Button
              variant="secondary"
              icon="sync"
              size="md"
              onClick={() => onRefresh(variable)}
              style={{ marginLeft: '4px' }}
              aria-label={`Refresh ${variable.label || variable.name}`}
            />
          </Tooltip>
        )}
      {/* BMC code ends */}
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
      <Tooltip content={variable.description} placement={'bottom'}>
        <label
          className="gf-form-label gf-form-label--variable"
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
          htmlFor={elementId}
        >
          {labelOrName}
        </label>
      </Tooltip>
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
