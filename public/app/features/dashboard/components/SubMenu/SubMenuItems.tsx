import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, TypedVariableModel, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';

import { PickerRenderer } from '../../../variables/pickers/PickerRenderer';

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

  return (
    <>
      {visibleVariables.map((variable) => (
        <div
          key={variable.id}
          className={styles.submenuItem}
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
        >
          <PickerRenderer variable={variable} readOnly={readOnly} />
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
