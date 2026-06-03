import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { Dropdown, Menu, useStyles2 } from '@grafana/ui';
import { NAV_PERSONAS } from 'app/core/navigation/personas';

interface Props {
  currentPersonaId?: string;
  onApplyPersona: (personaId: string) => void;
}

export function NavPersonaMenu({ currentPersonaId, onApplyPersona }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Dropdown
        overlay={
          <Menu>
            {NAV_PERSONAS.map((persona) => (
              <Menu.Item
                key={persona.id}
                label={`${persona.label} — ${persona.description}`}
                onClick={() => onApplyPersona(persona.id)}
              />
            ))}
          </Menu>
        }
      >
        <button type="button" className={styles.button}>
          {t('navigation.megamenu.persona-menu', 'Nav layout')}
        </button>
      </Dropdown>
    </div>
  );
}

const getStyles = () => ({
  wrapper: css({
    padding: '8px 12px',
  }),
  button: css({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    textDecoration: 'underline',
  }),
});
