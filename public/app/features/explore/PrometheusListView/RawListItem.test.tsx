import { render, screen } from '@testing-library/react';
import React from 'react';

import RawListItem, { RawListProps } from './RawListItem';

function getCopyElement(): HTMLElement {
  return screen.getByLabelText('Copy to clipboard');
}

const defaultProps: RawListProps = {
  isExpandedView: false,
  listItemData: {
    Value: '1234556677888',
    __name__: 'metric_name_here',
    job: 'jobValue',
    instance: 'instanceValue',
  },
  listKey: '0',
  totalNumberOfValues: 1,
};

describe('RawListItem', () => {
  it('should render', () => {
    render(<RawListItem {...defaultProps} />);

    const copyElement = getCopyElement();

    expect(copyElement).toBeInTheDocument();
    expect(copyElement).toBeVisible();
    expect(screen.getAllByText(`jobValue`)[0]).toBeVisible();
    expect(screen.getAllByText(`instanceValue`)[0]).toBeVisible();
    expect(screen.getAllByText(`metric_name_here`)[0]).toBeVisible();
    expect(screen.getAllByText(`1234556677888`)[0]).toBeVisible();
  });
});
