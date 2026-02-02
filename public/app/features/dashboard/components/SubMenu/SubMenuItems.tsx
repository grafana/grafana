import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { AppEvents, GrafanaTheme2, QueryVariableModel, TypedVariableModel, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getVariableQueryRunner } from 'app/features/variables/query/VariableQueryRunner';
import { deleteVariableCache } from 'app/features/dashboard-scene/settings/variables/utils';

import { PickerRenderer } from '../../../variables/pickers/PickerRenderer';
import { getDashboardSrv } from '../../services/DashboardSrv';

interface Props {
  variables: TypedVariableModel[];
  readOnly?: boolean;
}

export const SubMenuItems = ({ variables, readOnly }: Props) => {
  const [visibleVariables, setVisibleVariables] = useState<TypedVariableModel[]>([]);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setVisibleVariables(variables.filter((state) => state.hide !== VariableHide.hideVariable));
  }, [variables]);

  if (visibleVariables.length === 0) {
    return null;
  }

  // BMC code starts - redis caching
  const handleRefresh = async (variable: QueryVariableModel) => {
    try {
      const queryVar = variable as QueryVariableModel;
      const dsInstance = await getDataSourceSrv().get(queryVar.datasource?.uid || '');

      const dashboardUID = getDashboardSrv().getCurrent()?.uid;

      const identifier = {
        id: queryVar.id,
        type: queryVar.type,
        rootStateKey: dashboardUID,
      };

      const success = await deleteVariableCache(queryVar, dashboardUID, false);

      if (success) {
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [
            t(
              'bmc.variables.variable-caching.cache-delete-success',
              'Cache deleted successfully for variable {{variableName}}',
              { variableName: variable.name }
            ),
          ],
        });
      } else {
        console.error(`couldn't delete cache for variable ${variable.name}`);
        return;
      }

      const runner = getVariableQueryRunner();
      runner.queueRequest({
        identifier,
        datasource: dsInstance,
        searchFilter: '',
      });
    } catch (err) {
      console.error(`Failed to refresh variable "${variable.name}":`, err);
    }
  };
  // BMC code changes end

  return (
    <>
      {visibleVariables.map((variable) => (
        <div
          key={variable.id}
          className={styles.submenuItem}
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
        >
          <PickerRenderer
            variable={variable}
            readOnly={readOnly}
            onRefresh={handleRefresh} // BMC code
          />
        </div>
      ))}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  submenuItem: css({
    display: 'inline-block',

    '.fa-caret-down': {
      fontSize: '75%',
      paddingLeft: theme.spacing(1),
    },

    '.gf-form': {
      marginBottom: 0,
    },
  }),
});
