import { css } from '@emotion/css';

import { Icon, useStyles2 } from '@grafana/ui';

import { RepoType } from '../Wizard/types';
import { getRepositoryTypeConfig } from '../utils/repositoryTypes';

export function RepoIcon({ type }: { type: RepoType | undefined }) {
  const styles = useStyles2(getStyles);
  const config = type ? getRepositoryTypeConfig(type) : undefined;

  if (!config) {
    return <Icon name="database" size="xxl" />;
  }
  return (
    <>
      {config.logo ? (
        <img src={config.logo} alt={config.label} className={styles.logo} />
      ) : (
        <Icon name={config.icon} size="xxl" />
      )}
    </>
  );
}

function getStyles() {
  return {
    logo: css({
      width: 34,
      height: 34,
    }),
  };
}
