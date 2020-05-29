import React from 'react';
import { FieldConfigEditorProps, StringFieldConfigSettings, GrafanaTheme } from '@grafana/data';
import { Input } from '../Input/Input';
import { Icon } from '../Icon/Icon';
import { stylesFactory, getTheme } from '../../themes';
import { css } from 'emotion';

type Props = FieldConfigEditorProps<string[], StringFieldConfigSettings>;

export class StringArrayEditor extends React.PureComponent<Props> {
  onRemoveString = (index: number) => {
    const { value, onChange } = this.props;
    const copy = [...value];
    copy.splice(index, 1);
    onChange(copy);
  };

  onValueChange = (e: React.SyntheticEvent, idx: number) => {
    const evt = e as React.KeyboardEvent<HTMLInputElement>;
    if (e.hasOwnProperty('key')) {
      if (evt.key !== 'Enter') {
        return;
      }
    }
    const { value, onChange } = this.props;

    // Form event, or Enter
    const v = evt.currentTarget.value.trim();
    if (idx < 0) {
      if (v) {
        evt.currentTarget.value = ''; // reset last value
        onChange([...value, v]);
      }
      return;
    }

    if (!v) {
      return this.onRemoveString(idx);
    }

    const copy = [...value];
    copy[idx] = v;
    onChange(copy);
  };

  render() {
    const { value, item } = this.props;
    const styles = getStyles(getTheme());
    return (
      <div>
        {value.map((v, index) => {
          return (
            <Input
              className={styles.textInput}
              key={`${index}/${v}`}
              placeholder={item.settings?.placeholder}
              defaultValue={v || ''}
              onBlur={e => this.onValueChange(e, index)}
              onKeyDown={e => this.onValueChange(e, index)}
              suffix={<Icon className={styles.trashIcon} name="trash-alt" onClick={() => this.onRemoveString(index)} />}
            />
          );
        })}

        <Input
          className={styles.textInput}
          placeholder={item.settings?.placeholder || 'Enter text'}
          defaultValue={''}
          onBlur={e => this.onValueChange(e, -1)}
          onKeyDown={e => this.onValueChange(e, -1)}
          suffix={<Icon name="plus-circle" />}
        />
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    textInput: css`
      margin-bottom: 5px;
      &:hover {
        border: 1px solid ${theme.colors.formInputBorderHover};
      }
    `,
    trashIcon: css`
      color: ${theme.colors.textWeak};
      cursor: pointer;

      &:hover {
        color: ${theme.colors.text};
      }
    `,
  };
});
