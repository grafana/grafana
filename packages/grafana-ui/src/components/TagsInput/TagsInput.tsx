import React, { ChangeEvent, KeyboardEvent, FC, useState } from 'react';
import { css } from '@emotion/css';
import { Button } from '../Button';
import { TagItem } from './TagItem';
import { useStyles } from '../../themes/ThemeContext';
import { GrafanaTheme } from '@grafana/data';
import { Input } from '../Input/Input';

export interface Props {
  placeholder?: string;
  tags?: string[];
  onChange: (tags: string[]) => void;
}

export const TagsInput: FC<Props> = ({ placeholder = 'New tag (enter key to add)', tags = [], onChange }) => {
  const [newTagName, setNewName] = useState('');
  const styles = useStyles(getStyles);

  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNewName(event.target.value);
  };

  const onRemove = (tagToRemove: string) => {
    onChange(tags?.filter((x) => x !== tagToRemove));
  };

  const onAdd = (event: React.MouseEvent) => {
    event.preventDefault();
    onChange(tags.concat(newTagName));
    setNewName('');
  };

  const onKeyboardAdd = (event: KeyboardEvent) => {
    event.preventDefault();
    if (event.key === 'Enter' && newTagName !== '') {
      onChange(tags.concat(newTagName));
      setNewName('');
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.tags}>
        {tags?.map((tag: string, index: number) => {
          return <TagItem key={`${tag}-${index}`} name={tag} onRemove={onRemove} />;
        })}
      </div>
      <div>
        <Input
          placeholder={placeholder}
          onChange={onNameChange}
          value={newTagName}
          onKeyUp={onKeyboardAdd}
          suffix={
            newTagName.length > 0 && (
              <Button buttonStyle="text" className={styles.addButtonStyle} onClick={onAdd} size="md">
                Add
              </Button>
            )
          }
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    height: ${theme.spacing.formInputHeight}px;
    align-items: center;
    display: flex;
    flex-wrap: wrap;
  `,
  tags: css`
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
    margin-right: ${theme.spacing.xs};
  `,
  addButtonStyle: css`
    margin: 0 -${theme.spacing.sm};
  `,
});
