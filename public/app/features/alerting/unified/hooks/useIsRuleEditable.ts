import { contextSrv } from 'app/core/services/context_srv';
import { isGrafanaRulerRule } from '../utils/rules';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';
import { useFolder } from './useFolder';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { checkIfLotexSupportsEditingRulesAction } from '../state/actions';

interface ResultBag {
  isEditable?: boolean;
  loading: boolean;
}

export function useIsRuleEditable(rulesSourceName: string, rule?: RulerRuleDTO): ResultBag {
  const checkEditingRequests = useUnifiedAlertingSelector((state) => state.lotexSupportsRuleEditing);
  const dispatch = useDispatch();
  const folderUID = rule && isGrafanaRulerRule(rule) ? rule.grafana_alert.namespace_uid : undefined;

  const { folder, loading } = useFolder(folderUID);

  useEffect(() => {
    if (checkEditingRequests[rulesSourceName] === undefined) {
      dispatch(checkIfLotexSupportsEditingRulesAction(rulesSourceName));
    }
  }, [rulesSourceName, checkEditingRequests, dispatch]);

  if (!rule) {
    return { isEditable: false, loading: false };
  }

  // grafana rules can be edited if user can edit the folder they're in
  if (isGrafanaRulerRule(rule)) {
    if (!folderUID) {
      throw new Error(
        `Rule ${rule.grafana_alert.title} does not have a folder uid, cannot determine if it is editable.`
      );
    }
    return {
      isEditable: folder?.canSave,
      loading,
    };
  }

  // prom rules are only editable by users with Editor role and only if rules source supports editing
  return {
    isEditable: contextSrv.isEditor && !!checkEditingRequests[rulesSourceName]?.result,
    loading: !!checkEditingRequests[rulesSourceName]?.loading,
  };
}
