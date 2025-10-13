import { Registry, RegistryItem } from './Registry';

export enum UnaryOperationID {
  Abs = 'abs',
  Exp = 'exp',
  Ln = 'ln',
  Round = 'round',
  Floor = 'floor',
  Ceil = 'ceil',
}

export type UnaryOperation = (value: number) => number;

interface UnaryOperatorInfo extends RegistryItem {
  operation: UnaryOperation;
  unaryOperationID: UnaryOperationID;
}

export const unaryOperators = new Registry<UnaryOperatorInfo>(() => {
  return [
    {
      id: UnaryOperationID.Abs,
      name: 'Absolute value',
      operation: (value: number) => Math.abs(value),
      unaryOperationID: UnaryOperationID.Abs,
    },
    {
      id: UnaryOperationID.Exp,
      name: 'Natural exponent',
      operation: (value: number) => Math.exp(value),
      unaryOperationID: UnaryOperationID.Exp,
    },
    {
      id: UnaryOperationID.Ln,
      name: 'Natural logarithm',
      operation: (value: number) => Math.log(value),
      unaryOperationID: UnaryOperationID.Ln,
    },
    {
      id: UnaryOperationID.Round,
      name: 'Round',
      operation: (value: number) => Math.round(value),
      unaryOperationID: UnaryOperationID.Round,
    },
    {
      id: UnaryOperationID.Floor,
      name: 'Floor',
      operation: (value: number) => Math.floor(value),
      unaryOperationID: UnaryOperationID.Floor,
    },
    {
      id: UnaryOperationID.Ceil,
      name: 'Ceiling',
      operation: (value: number) => Math.ceil(value),
      unaryOperationID: UnaryOperationID.Ceil,
    },
  ];
});
