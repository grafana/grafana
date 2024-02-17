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
  binaryOperationID: BinaryOperationID;
}

export const binaryOperators = new Registry<BinaryOperatorInfo>(() => {
  return [
    {
      id: BinaryOperationID.Add,
      name: 'Add',
      operation: (a: number, b: number) => a + b,
      binaryOperationID: BinaryOperationID.Add,
    },
    {
      id: BinaryOperationID.Subtract,
      name: 'Subtract',
      operation: (a: number, b: number) => a - b,
      binaryOperationID: BinaryOperationID.Subtract,
    },
    {
      id: BinaryOperationID.Multiply,
      name: 'Multiply',
      operation: (a: number, b: number) => a * b,
      binaryOperationID: BinaryOperationID.Multiply,
    },
    {
      id: BinaryOperationID.Divide,
      name: 'Divide',
      operation: (a: number, b: number) => a / b,
      binaryOperationID: BinaryOperationID.Divide,
    },
  ];
});
