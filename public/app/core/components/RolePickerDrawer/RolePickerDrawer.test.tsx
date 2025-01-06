import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';

import { RolePickerDrawer } from './RolePickerDrawer';

const props = {
  onClose: () => {},
};

describe('RolePickerDrawer', () => {
  interface WrapperProps {
    children: React.ReactNode;
  }

  const Wrapper = (props: WrapperProps) => {
    const formMethods = useForm({
      defaultValues: {
        name: 'service-account-name',
      },
    });
    return <FormProvider {...formMethods}>{props.children}</FormProvider>;
  };

  it('should render', () => {
    render(
      <Wrapper>
        <RolePickerDrawer {...props} />
      </Wrapper>
    );

    expect(screen.getByRole('heading', { name: 'service-account-name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'documentation' })).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'None' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Viewer' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Editor' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Admin' })).toBeInTheDocument();
  });
});
