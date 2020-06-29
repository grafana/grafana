import { RegistryItem, Registry } from './Registry';

export enum BinaryOperationID {
  Add = '+',
  Subtract = '-',
  Divide = '/',
  Multiply = '*',
}

export type BinaryOperation = (left: number, right: number) => number;

interface BinaryOperatorInfo extends RegistryItem {
  operation: BinaryOperation;
}

export const binaryOperators = new Registry<BinaryOperatorInfo>(() => {
  return [
    {
      id: BinaryOperationID.Add,
      name: 'Add',
      operation: (a: number, b: number) => a + b,
    },
    {
      id: BinaryOperationID.Subtract,
      name: 'Subtract',
      operation: (a: number, b: number) => a - b,
    },
    {
      id: BinaryOperationID.Multiply,
      name: 'Multiply',
      operation: (a: number, b: number) => a * b,
    },
    {
      id: BinaryOperationID.Divide,
      name: 'Divide',
      operation: (a: number, b: number) => a / b,
    },
  ];
});
