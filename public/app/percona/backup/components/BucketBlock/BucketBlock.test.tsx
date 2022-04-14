import React from 'react';
import { BucketBlock } from './BucketBlock';
import { render, screen } from '@testing-library/react';

describe('BucketBlock', () => {
  it('should render', () => {
    render(<BucketBlock bucketName="bucket" />);
    expect(screen.getByTestId('storage-location-bucket')).toBeInTheDocument();
  });
});
