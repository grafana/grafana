import { render, screen } from '@testing-library/react';

import { FieldConfigMappingHandlerArgumentsEditor, Props } from './FieldConfigMappingHandlerArgumentsEditor';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockOnChange = jest.fn();

const props: Props = {
  handlerKey: null,
  handlerArguments: {},
  onChange: mockOnChange,
};

const setup = (testProps?: Partial<Props>) => {
  const editorProps = { ...props, ...testProps };
  return render(<FieldConfigMappingHandlerArgumentsEditor {...editorProps} />);
};

describe('FieldConfigMappingHandlerArgumentsEditor', () => {
  it('Should show a color picker when thresholds are selected', async () => {
    setup({ handlerKey: 'threshold1' });

    expect(await screen.findByDisplayValue('Threshold color')).toBeInTheDocument();
    expect(await screen.findByLabelText('red color')).toBeInTheDocument();
  });

  it('Should show the correct selected color', async () => {
    setup({ handlerKey: 'threshold1', handlerArguments: { threshold: { color: 'orange' } } });

    expect(await screen.findByDisplayValue('Threshold color')).toBeInTheDocument();
    expect(await screen.findByLabelText('orange color')).toBeInTheDocument();
  });
});
