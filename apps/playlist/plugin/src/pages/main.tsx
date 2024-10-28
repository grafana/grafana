import * as React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';


// TodoList represents the plugin page that list todos.
// Within this page the user can list, create and delete todos.
export const MainPage = () => {
  useStyles2(getStyles);

  return (
      <div>
        <h1>Main Landing Page</h1>
        <div>This is your main landing page</div>
      </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  marginTop: css`
    margin-top: ${theme.spacing(2)};
  `,
});
