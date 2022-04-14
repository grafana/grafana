import React from 'react';
import { S3Fields } from './S3Fields';
import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';
import { Form } from 'react-final-form';
import { render, screen } from '@testing-library/react';

jest.mock('app/percona/shared/components/Elements/SecretToggler', () => ({
  SecretToggler: jest.fn(({ children }) => <div data-testid="secret-toggler">{children}</div>),
}));

describe('S3Fields', () => {
  it('should pass initial values', () => {
    render(
      <Form
        onSubmit={jest.fn()}
        render={({ form }) => (
          <S3Fields bucketName="bucket" endpoint="/foo" accessKey="accessKey" secretKey="secretKey" />
        )}
      />
    );

    const inputs = screen.getAllByRole('textbox').filter((item) => item.tagName === 'INPUT') as HTMLInputElement[];
    expect(inputs.find((item) => item.value === '/foo')).toBeTruthy();
    expect(inputs.find((item) => item.value === 'accessKey')).toBeTruthy();
    expect(inputs.find((item) => item.value === 'bucket')).toBeTruthy();
    expect(SecretToggler).toHaveBeenCalledWith(expect.objectContaining({ secret: 'secretKey' }), expect.anything());
  });
});
