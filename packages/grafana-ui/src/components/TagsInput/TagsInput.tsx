import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Trans } from '../../utils/i18n';
import { Button } from '../Button';
import { Input } from '../Input/Input';

import { TagItem } from './TagItem';

export interface Props {
  placeholder?: string;
  /** Array of selected tags */
  tags?: string[];
  onChange: (tags: string[]) => void;
  width?: number;
  id?: string;
  className?: string;
  /** Toggle disabled state */
  disabled?: boolean;
  /** Enable adding new tags when input loses focus */
  addOnBlur?: boolean;
  /** Toggle invalid state */
  invalid?: boolean;
  /** Colours the tags 'randomly' based on the name. Defaults to true */
  autoColors?: boolean;
}

export const TagsInput = ({
  placeholder = 'New tag (enter key to add)',
  tags = [],
  onChange,
  width,
  className,
  disabled,
  addOnBlur,
  invalid,
  id,
  autoColors = true,
}: Props) => {
  const [newTagName, setNewTagName] = useState('');
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const onNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setNewTagName(event.target.value);
  }, []);

  const onRemove = (tagToRemove: string) => {
    onChange(tags.filter((x) => x !== tagToRemove));
  };

  const onAdd = (event?: React.MouseEvent | React.KeyboardEvent) => {
    event?.preventDefault();
    if (!tags.includes(newTagName)) {
      onChange(tags.concat(newTagName));
    }
    setNewTagName('');
  };

  const onBlur = () => {
    if (addOnBlur && newTagName) {
      onAdd();
    }
  };

  const onKeyboardAdd = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && newTagName !== '') {
      onAdd(event);
    }
  };

  return (
    <div className={cx(styles.wrapper, className, width ? css({ width: theme.spacing(width) }) : '')}>
      <Input
        id={id}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onNameChange}
        value={newTagName}
        onKeyDown={onKeyboardAdd}
        onBlur={onBlur}
        invalid={invalid}
        suffix={
          <Button
            fill="text"
            className={styles.addButtonStyle}
            onClick={onAdd}
            size="md"
            disabled={newTagName.length <= 0}
          >
            <Trans i18nKey="grafana-ui.tags-input.add">Add</Trans>
          </Button>
        }
      />
      {tags?.length > 0 && (
        <ul className={styles.tags}>
          {tags.map((tag) => (
            <TagItem key={tag} name={tag} onRemove={onRemove} disabled={disabled} autoColors={autoColors} />
          ))}
        </ul>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    minHeight: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  }),
  tags: css({
    display: 'flex',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  }),
  addButtonStyle: css({
    margin: `0 -${theme.spacing(1)}`,
  }),
});
