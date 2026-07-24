import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';

import { RolePickerSelect } from './RolePickerSelect';

describe('RolePickerSelect', () => {
  interface WrapperProps {
    children: React.ReactNode;
  }

  const Wrapper = (props: WrapperProps) => {
    const formMethods = useForm({});
    return <FormProvider {...formMethods}>{props.children}</FormProvider>;
  };

  it('should render', async () => {
    const props = {};
    render(
      <Wrapper>
        <RolePickerSelect {...props} />
      </Wrapper>
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
