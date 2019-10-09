import React, { ChangeEvent, KeyboardEvent, PureComponent } from 'react';
import { css } from 'emotion';
import { Button, Input } from '..';
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

  onAdd = () => {
    if (this.state.newTag !== '') {
      this.setNewTags();
    }
  };

  onKeyboardAdd = (event: KeyboardEvent) => {
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

    const tagsCloudStyle = css`
      display: flex;
      justify-content: flex-start;
      margin-bottom: 8px;
      flex-wrap: wrap;
    `;

    const addButtonStyle = css`
      margin-left: 8px;
      margin-top: 2px;
    `;

    return (
      <div className="width-20">
        <div className="gf-form-inline">
          <Input placeholder="Add Name" onChange={this.onNameChange} value={newTag} onKeyUp={this.onKeyboardAdd} />
          <Button className={addButtonStyle} onClick={this.onAdd} variant="primary" size="md">
            Add
          </Button>
        </div>
        <div className={tagsCloudStyle}>
          {tags &&
            tags.map((tag: string, index: number) => {
              return <TagItem key={`${tag}-${index}`} name={tag} onRemove={this.onRemove} />;
            })}
        </div>
      </div>
    );
  }
}
