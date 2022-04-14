import React from 'react';
import { Form } from 'react-final-form';
import { TemplateParam, TemplateParamType, TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRuleParamField } from './AlertRuleParamField';
import { NumberInputField } from '@percona/platform-core';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    NumberInputField: jest.fn((props) => <div data-testid="number-input-field" {...props} />),
  };
});

describe('AlertRuleParamField', () => {
  const param: TemplateParam = {
    name: 'param',
    type: TemplateParamType.FLOAT,
    unit: TemplateParamUnit.SECONDS,
    summary: 'float param',
    float: {
      hasDefault: true,
      hasMin: true,
      hasMax: false,
    },
  };
  const paramUnsupported: TemplateParam = {
    ...param,
    type: TemplateParamType.BOOL,
  };

  it('should return null if unsupported type is passed', async () => {
    const { container } = await waitFor(() =>
      render(<Form onSubmit={jest.fn()} render={() => <AlertRuleParamField param={paramUnsupported} />} />)
    );
    expect(container.children).toHaveLength(0);
  });

  it('should render supported type fields', () => {
    render(<Form onSubmit={jest.fn()} render={() => <AlertRuleParamField param={param} />} />);
    expect(NumberInputField).toHaveBeenCalled();
  });

  it('should have validators', () => {
    render(<AlertRuleParamField param={param} />);
    expect(screen.getByTestId('number-input-field').getAttribute('validators')?.split(',')).toHaveLength(2);
  });
});
