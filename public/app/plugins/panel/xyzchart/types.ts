import { extend, ReactThreeFiber, Euler } from '@react-three/fiber';
import { Line } from 'three';

// <line /> is being reserved by dom, so we need to alias it
extend({ Line_: Line });

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      line_: ReactThreeFiber.Object3DNode<Line, typeof Line>;
    }
  }
}

/**
 * A simple point geometry in the format [x, y, z].
 */
export type PointGeometry = [number, number, number];

/**
 * A simple line geometry with:
 * LineGeometry[0] --> Origin Point
 * LineGeometry[1] --> Destinaiton Point
 */
export type LineGeometry = [PointGeometry, PointGeometry];

export interface ColorMap {
  [key: string]: string;
}

export interface LabelProps {
  position: PointGeometry;
  text: string;
  rotation?: Euler;
  direction: Direction;
  labelSize?: number;
}

export interface GridVolumeProps {
  intervalLabels: IntervalLabels;
}

export interface GridPlaneProps {
  direction: Direction;
  intervalLabels: string[];
}

export enum Direction {
  Up = 1,
  Right,
  Forward,
}

export interface AxisData {
  axisPoints: PointGeometry[];
  intervalGeometries: number[][][];
  intervalLabelPos: PointGeometry[];
  labelRotation: Euler;
  color: string;
}

export interface PointData {
  points: Float32Array;
  colors: Float32Array;
}

export interface IntervalLabels {
  xLabels: string[];
  yLabels: string[];
  zLabels: string[];
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}
