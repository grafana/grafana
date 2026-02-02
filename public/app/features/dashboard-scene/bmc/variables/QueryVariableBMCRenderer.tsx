// BMC file
import { useMemo } from 'react';
import { lastValueFrom } from 'rxjs';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { MultiValueVariable, QueryVariable, SceneComponentProps } from '@grafana/scenes';
import { Button, Stack, Tooltip } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { FEATURE_CONST, getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { deleteVariableCache } from '../../settings/variables/utils';

// Component to render QueryVariable with refresh button for cached variables
export function QueryVariableBMCRenderer({ model }: SceneComponentProps<MultiValueVariable>) {
  const variableState = model.useState();

  // Check if caching is enabled for this variable
  const isCachingEnabled = useMemo(() => {
    // @ts-expect-error - bmcVarCache is a property of the QueryVariableBMC model
    return variableState?.bmcVarCache;
  }, [variableState]);

  // Refresh handler for cached variables
  const handleRefresh = async () => {
    try {
      const dashboardUID = getDashboardSrv().getCurrent()?.uid;

      // Delete the variable cache
      // @ts-expect-error
      const success = await deleteVariableCache(model.state, dashboardUID, false);

      if (success) {
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [
            t(
              'bmc.variables.variable-caching.cache-delete-success',
              'Cache deleted successfully for variable {{variableName}}',
              { variableName: variableState.name }
            ),
          ],
        });
      } else {
        console.error(`couldn't delete cache for variable ${variableState.name}`);
        return;
      }

      // This triggers the variable to re-fetch its options
      await lastValueFrom(model.validateAndUpdate());
    } catch (err) {
      console.error(`Failed to refresh variable "${variableState.name}":`, err);
    }
  };

  // Render default QueryVariable component wrapped with refresh button if caching is enabled
  return (
    <Stack gap={0}>
      <QueryVariable.Component model={model} />
      {getFeatureStatus(FEATURE_CONST.BHD_ENABLE_VAR_CACHING) && variableState.type === 'query' && isCachingEnabled && (
        <Tooltip content="Refresh this variable" placement="bottom">
          <Button
            variant="secondary"
            icon="sync"
            size="md"
            onClick={handleRefresh}
            style={{ marginLeft: '4px' }}
            aria-label={`Refresh ${variableState.label || variableState.name}`}
          />
        </Tooltip>
      )}
    </Stack>
  );
}
