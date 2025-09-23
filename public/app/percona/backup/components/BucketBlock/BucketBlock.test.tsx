import { render, screen } from '@testing-library/react';

import { BucketBlock } from './BucketBlock';

describe('BucketBlock', () => {
  it('should render', () => {
    render(<BucketBlock bucketName="bucket" />);
    expect(screen.getByTestId('storage-location-bucket')).toBeInTheDocument();
  });
});
