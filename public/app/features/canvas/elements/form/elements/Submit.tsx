import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { callApi } from 'app/plugins/panel/canvas/editor/element/utils';

import { FormChild } from './FormElementTypeEditor';

interface Props {
  formItem: FormChild;
}

export const Submit = ({ formItem }: Props) => {
  const styles = useStyles2(getStyles);

  const [isLoading, setIsLoading] = useState(false);

  const updateLoadingStateCallback = (loading: boolean) => {
    setIsLoading(loading);
  };

  const onClick = () => {
    if (formItem?.api && formItem?.api?.endpoint) {
      setIsLoading(true);
      callApi(formItem.api, updateLoadingStateCallback);
    }
  };

  return (
    <Button type="submit" variant={'primary'} onClick={onClick} className={styles.button}>
      <span>
        {isLoading && <Spinner inline={true} className={styles.buttonSpinner} />}
        Submit
      </span>
    </Button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    height: '100%',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  }),
  buttonSpinner: css({
    marginRight: theme.spacing(0.5),
  }),
});
