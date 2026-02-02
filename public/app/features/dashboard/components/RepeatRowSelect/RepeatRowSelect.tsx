import { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneObject, sceneGraph } from '@grafana/scenes';
import { Select } from '@grafana/ui';
import { t } from 'app/core/internationalization'
import { useSelector } from 'app/types';

import { getLastKey, getVariablesByKey } from '../../../variables/state/selectors';

export interface Props {
  id?: string;
  repeat?: string;
  onChange: (name?: string) => void;
}

export const RepeatRowSelect = ({ repeat, onChange, id }: Props) => {
  const variables = useSelector((state) => {
    return getVariablesByKey(getLastKey(state), state);
  });

  const variableOptions = useMemo(() => {
    const options: Array<SelectableValue<string | null>> = variables.map((item) => {
      return { label: item.name, value: item.name };
    });
    if (options.length === 0) {
      options.unshift({
        // BMC Change: To enable localization for below text
        label: t(
          'bmcgrafana.dashboards.edit-panel.panel-options.repeat-options.no-template-variables-found',
          'No template variables found'
        ),
        // BMC Change ends
        value: null,
      });
    }

    options.unshift({
      // BMC Change: To enable localization for below text
      label: t('bmcgrafana.dashboards.edit-panel.panel-options.repeat-options.disable-repeating', 'Disable repeating'),
      // BMC Change ends
      value: null,
    });

    return options;
  }, [variables]);

  const onSelectChange = useCallback((option: SelectableValue<string | null>) => onChange(option.value!), [onChange]);

  return <Select inputId={id} value={repeat} onChange={onSelectChange} options={variableOptions} />;
};

interface Props2 {
  sceneContext: SceneObject;
  repeat: string | undefined;
  id?: string;
  onChange: (name?: string) => void;
}

export const RepeatRowSelect2 = ({ sceneContext, repeat, id, onChange }: Props2) => {
  const sceneVars = useMemo(() => sceneGraph.getVariables(sceneContext.getRoot()), [sceneContext]);
  const variables = sceneVars.useState().variables;

  const variableOptions = useMemo(() => {
    const options: Array<SelectableValue<string | null>> = variables.map((item) => ({
      label: item.state.name,
      value: item.state.name,
    }));

    if (options.length === 0) {
      options.unshift({
        label: 'No template variables found',
        value: null,
      });
    }

    options.unshift({
      label: 'Disable repeating',
      value: null,
    });

    return options;
  }, [variables]);

  const onSelectChange = useCallback((option: SelectableValue<string | null>) => onChange(option.value!), [onChange]);

  return <Select inputId={id} value={repeat} onChange={onSelectChange} options={variableOptions} />;
};
