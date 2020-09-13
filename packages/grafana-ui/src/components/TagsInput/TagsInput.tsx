import React, { ChangeEvent, KeyboardEvent, PureComponent } from 'react';
import { css, cx } from 'emotion';
import { stylesFactory } from '../../themes/stylesFactory';
import { Button } from '../Button';
import { Input } from '../Forms/Legacy/Input/Input';
import { TagItem } from './TagItem';

interface Props {
  tags?: string[];
  width?: number;

  onChange: (tags: string[]) => void;
}

interface State {
  newTag: string;
  tags: string[];
}

export class TagsInput extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      newTag: '',
      tags: this.props.tags || [],
    };
  }

  onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      newTag: event.target.value,
    });
  };

  onRemove = (tagToRemove: string) => {
    this.setState(
      (prevState: State) => ({
        ...prevState,
        tags: prevState.tags.filter(tag => tagToRemove !== tag),
      }),
      () => this.onChange()
    );
  };

  // Using React.MouseEvent to avoid tslint error
  onAdd = (event: React.MouseEvent) => {
    event.preventDefault();
    if (this.state.newTag !== '') {
      this.setNewTags();
    }
  };

  onKeyboardAdd = (event: KeyboardEvent) => {
    event.preventDefault();
    if (event.key === 'Enter' && this.state.newTag !== '') {
      this.setNewTags();
    }
  };

  setNewTags = () => {
    // We don't want to duplicate tags, clearing the input if
    // the user is trying to add the same tag.
    if (!this.state.tags.includes(this.state.newTag)) {
      this.setState(
        (prevState: State) => ({
          ...prevState,
          tags: [...prevState.tags, prevState.newTag],
          newTag: '',
        }),
        () => this.onChange()
      );
    } else {
      this.setState({ newTag: '' });
    }
  };

  onChange = () => {
    this.props.onChange(this.state.tags);
  };

  render() {
    const { tags, newTag } = this.state;

    const getStyles = stylesFactory(() => ({
      tagsCloudStyle: css`
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
      `,

      addButtonStyle: css`
        margin-left: 8px;
      `,
    }));

    return (
      <div className="width-20">
        <div
          className={cx(
            ['gf-form-inline'],
            css`
              margin-bottom: 4px;
            `
          )}
        >
          <Input placeholder="Add Name" onChange={this.onNameChange} value={newTag} onKeyUp={this.onKeyboardAdd} />
          <Button className={getStyles().addButtonStyle} onClick={this.onAdd} variant="secondary" size="md">
            Add
          </Button>
        </div>
        <div className={getStyles().tagsCloudStyle}>
          {tags &&
            tags.map((tag: string, index: number) => {
              return <TagItem key={`${tag}-${index}`} name={tag} onRemove={this.onRemove} />;
            })}
        </div>
      </div>
    );
  }
}
