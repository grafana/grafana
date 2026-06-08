import { render, screen } from '@testing-library/react';
import { type UseFormRegister } from 'react-hook-form';

import { type RepositoryFormData } from '../types';

import { CommitMessageTemplateField } from './CommitMessageTemplateField';

describe('CommitMessageTemplateField', () => {
  it('renders the label and registers the input under commit.singleResourceMessageTemplate', () => {
    const registerMock = jest.fn().mockReturnValue({});
    render(<CommitMessageTemplateField register={registerMock as unknown as UseFormRegister<RepositoryFormData>} />);

    expect(screen.getByText('Commit message template')).toBeInTheDocument();
    expect(registerMock).toHaveBeenCalledWith('commit.singleResourceMessageTemplate');
  });

  it('renders the placeholder with literal {{action}} / {{title}} variables', () => {
    const registerMock = jest.fn().mockReturnValue({});
    render(<CommitMessageTemplateField register={registerMock as unknown as UseFormRegister<RepositoryFormData>} />);

    const input = screen.getByPlaceholderText('feat(dashboards): {{action}} {{title}}');
    expect(input).toBeInTheDocument();
  });

  it('describes the available placeholders with their double-brace form', () => {
    const registerMock = jest.fn().mockReturnValue({});
    render(<CommitMessageTemplateField register={registerMock as unknown as UseFormRegister<RepositoryFormData>} />);

    expect(
      screen.getByText(
        /\{\{action\}\} \(create\/update\/delete\/move\/rename\), \{\{resourceKind\}\} \(dashboard\/folder\), \{\{resourceID\}\}, \{\{title\}\}/
      )
    ).toBeInTheDocument();
  });
});
