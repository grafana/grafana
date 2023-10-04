import { Registry, RegistryItem } from './Registry';

export enum UnaryOperationID {
  Abs = 'abs',
  Exp = 'exp',
  Ln = 'ln',
  Floor = 'floor',
  Ceil = 'ceil',
}

export type UnaryOperation = (value: number) => number;

interface UnaryOperatorInfo extends RegistryItem {
  operation: UnaryOperation;
}

export const unaryOperators = new Registry<UnaryOperatorInfo>(() => {
  return [
    {
      id: UnaryOperationID.Abs,
      name: 'abs',
      operation: (value: number) => Math.abs(value),
    },
    {
      id: UnaryOperationID.Exp,
      name: 'exp',
      operation: (value: number) => Math.exp(value),
    },
    {
      id: UnaryOperationID.Ln,
      name: 'ln',
      operation: (value: number) => Math.log(value),
    },
    {
      id: UnaryOperationID.Floor,
      name: 'floor',
      operation: (value: number) => Math.floor(value),
    },
    {
      id: UnaryOperationID.Ceil,
      name: 'ceil',
      operation: (value: number) => Math.ceil(value),
    },
  ];
});
