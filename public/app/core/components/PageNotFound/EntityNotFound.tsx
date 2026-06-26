import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EmptyState, TextLink, useStyles2 } from '@grafana/ui';

export interface Props {
  /**
   * Defaults to Page
   */
  entity?: string;
}

export function EntityNotFound({ entity = 'Страница' }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} data-testid={selectors.components.EntityNotFound.container}>
      <EmptyState message={`${entity} не найдена`} variant="not-found">
        Мы ищем, но, похоже, не можем найти эту страницу. Попробуйте вернуться <TextLink href="/">на главную</TextLink>.
      </EmptyState>
    </div>
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(8, 2, 2, 2),
    }),
  };
}
