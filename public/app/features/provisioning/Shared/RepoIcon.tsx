import { css } from '@emotion/css';

import { Icon, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/internal';

import { type RepoType } from '../Wizard/types';
import { getRepositoryTypeConfig } from '../utils/repositoryTypes';

interface RepoIconProps {
  type: RepoType | undefined;
  /**
   * Let the icon height grow from the xxl width instead of being constrained to a square box.
   * Use for icons whose viewBox is taller than square (e.g. github-enterprise stacks a wordmark
   * under the octocat) so the logo renders at the same size as the plain square icons.
   */
  autoHeight?: boolean;
}

export function RepoIcon({ type, autoHeight }: RepoIconProps) {
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
        <Icon name={config.icon} size="xxl" style={autoHeight ? { height: 'auto' } : undefined} />
      )}
    </>
  );
}

function getStyles() {
  return {
    logo: css({
      width: getSvgSize('xxl'),
      height: getSvgSize('xxl'),
    }),
  };
}
