import { explainOperator, operationDefinitions } from './operations';
import { LokiOperationId } from './types';

const undocumentedOperationsIds: string[] = [
  LokiOperationId.Addition,
  LokiOperationId.Subtraction,
  LokiOperationId.MultiplyBy,
  LokiOperationId.DivideBy,
  LokiOperationId.Modulo,
  LokiOperationId.Exponent,
  LokiOperationId.NestedQuery,
  LokiOperationId.EqualTo,
  LokiOperationId.NotEqualTo,
  LokiOperationId.GreaterThan,
  LokiOperationId.LessThan,
  LokiOperationId.GreaterOrEqual,
  LokiOperationId.LessOrEqual,
];

describe('explainOperator', () => {
  let operations = [];
  let undocumentedOperations = [];

  for (const definition of operationDefinitions) {
    if (!undocumentedOperationsIds.includes(definition.id)) {
      operations.push(definition.id);
    } else {
      undocumentedOperations.push(definition.id);
    }
  }

  test('Resolves operation definitions', () => {
    expect(operationDefinitions.length).toBeGreaterThan(0);
  });

  test.each(operations)('Returns docs for the %s operation', (operation) => {
    const explain = explainOperator(operation);

    expect(explain).toBeDefined();
    expect(explain).not.toBe('');
  });

  test.each(undocumentedOperations)('Returns empty docs for the %s operation', (operation) => {
    const explain = explainOperator(operation);

    expect(explain).toBeDefined();
    expect(explain).toBe('');
  });
});
