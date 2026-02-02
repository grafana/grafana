import { cleanup, render } from '@testing-library/react';

import { SelectableValue } from '@grafana/data';

import { TagList } from './TagList';

jest.mock('@grafana/ui', () => {
  const HorizontalGroupMock = () => <div></div>;
  HorizontalGroupMock.displayName = 'HorizontalGroup';
  const IconMock = ({ title }: { title: string }) => {
    return (
      <svg>
        <title> {title} </title>
      </svg>
    );
  };
  IconMock.displayName = 'Icon';

  return {
    Icon: IconMock,
    stylesFactory: () => () => ({
      itemContainer: '',
    }),
    useTheme2: () => {},
    HorizontalGroup: HorizontalGroupMock,
  };
});

describe('TagList', () => {
  afterEach(cleanup);
  it('should display tags', () => {
    let tags: SelectableValue[] = ['Tag1', 'Tag2', 'Tag3'].map((label) => ({ label, value: label }));
    const onChange = (selectedTags: SelectableValue[]) => (tags = selectedTags);

    const { container } = render(<TagList tags={tags} getTitle={getLabel} getTooltip={getLabel} onRemove={onChange} />);
    expect(container).toBeTruthy();
  });

  const getLabel = (item: SelectableValue) => item.label as string;
});
