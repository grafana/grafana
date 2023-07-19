import { createDataFrame, DataFrameDTO } from '@grafana/data';

import { FlameGraphDataContainer, LevelItem, nestedSetToLevels } from './dataTransform';

describe('nestedSetToLevels', () => {
  it('converts nested set data frame to levels', () => {
    // [1------]
    // [2---][6]
    // [3][5][7]
    // [4]   [8]
    //       [9]
    const frame = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 2, 3, 2, 1, 2, 3, 4] },
        { name: 'value', values: [10, 5, 3, 1, 1, 4, 3, 2, 1] },
        { name: 'label', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
        { name: 'self', values: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    });
    const [levels] = nestedSetToLevels(new FlameGraphDataContainer(frame));

    const n9: LevelItem = { itemIndexes: [8], start: 5, children: [], value: 1 };
    const n8: LevelItem = { itemIndexes: [7], start: 5, children: [n9], value: 2 };
    const n7: LevelItem = { itemIndexes: [6], start: 5, children: [n8], value: 3 };
    const n6: LevelItem = { itemIndexes: [5], start: 5, children: [n7], value: 4 };
    const n5: LevelItem = { itemIndexes: [4], start: 3, children: [], value: 1 };
    const n4: LevelItem = { itemIndexes: [3], start: 0, children: [], value: 1 };
    const n3: LevelItem = { itemIndexes: [2], start: 0, children: [n4], value: 3 };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [n3, n5], value: 5 };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n6], value: 10 };

    n2.parents = [n1];
    n6.parents = [n1];
    n3.parents = [n2];
    n5.parents = [n2];
    n4.parents = [n3];
    n7.parents = [n6];
    n8.parents = [n7];
    n9.parents = [n8];

    expect(levels[0]).toEqual([n1]);
    expect(levels[1]).toEqual([n2, n6]);
    expect(levels[2]).toEqual([n3, n5, n7]);
    expect(levels[3]).toEqual([n4, n8]);
    expect(levels[4]).toEqual([n9]);
  });

  it('converts nested set data if multiple same level items', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 5, 3, 1] },
        { name: 'label', values: ['1', '2', '3', '4'] },
        { name: 'self', values: [10, 5, 3, 1] },
      ],
    });
    const [levels] = nestedSetToLevels(new FlameGraphDataContainer(frame));

    const n4: LevelItem = { itemIndexes: [3], start: 8, children: [], value: 1 };
    const n3: LevelItem = { itemIndexes: [2], start: 5, children: [], value: 3 };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [], value: 5 };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n3, n4], value: 10 };

    n2.parents = [n1];
    n3.parents = [n1];
    n4.parents = [n1];

    expect(levels[0]).toEqual([n1]);
    expect(levels[1]).toEqual([n2, n3, n4]);
  });

  it('test', function () {
    const levels = [
      [0, 378, 0, 0, 316, 0, 0],
      [0, 12, 0, 0, 16, 0, 215, 0, 365, 4, 0, 300, 5, 3, 0, 1, 0, 0, 0, 0, 1],
      [0, 12, 0, 0, 16, 0, 216, 4, 230, 0, 5, 190, 0, 148, 0, 131, 0, 0, 105, 0, 4, 0, 1, 1, 0, 0, 0, 2],
      [
        0, 12, 0, 0, 16, 0, 217, 4, 230, 0, 5, 190, 0, 149, 0, 0, 0, 0, 1, 0, 145, 0, 3, 0, 0, 1, 0, 140, 0, 117, 0, 0,
        100, 0, 78, 0, 10, 0, 0, 3, 0, 9, 0, 1, 0, 0, 0, 0, 5,
      ],
      [
        0, 12, 0, 0, 16, 0, 218, 4, 230, 0, 5, 190, 0, 150, 0, 0, 0, 0, 1, 0, 146, 0, 3, 0, 0, 1, 0, 141, 0, 97, 0, 0,
        87, 0, 93, 0, 20, 0, 0, 10, 0, 83, 0, 0, 0, 0, 3, 0, 79, 0, 10, 0, 0, 3, 0, 10, 0, 1, 0, 0, 0, 0, 6,
      ],
      [
        0, 12, 0, 0, 16, 0, 219, 4, 230, 0, 5, 190, 0, 19, 0, 0, 0, 0, 1, 0, 15, 0, 3, 0, 0, 1, 0, 142, 0, 97, 0, 0, 87,
        0, 94, 0, 20, 0, 0, 10, 0, 84, 0, 0, 0, 0, 3, 0, 15, 0, 7, 0, 0, 3, 0, 24, 0, 3, 0, 0, 0, 0, 11, 0, 1, 0, 0, 0,
        0, 7,
      ],
      [
        0, 12, 12, 0, 16, 16, 220, 4, 8, 8, 5, 1, 1, 214, 0, 206, 0, 0, 173, 0, 159, 0, 7, 7, 0, 9, 9, 158, 0, 1, 1, 0,
        3, 3, 157, 0, 1, 1, 0, 0, 0, 156, 0, 6, 0, 0, 4, 0, 153, 0, 1, 0, 0, 0, 0, 151, 0, 0, 0, 0, 1, 0, 121, 0, 3, 0,
        0, 1, 0, 15, 0, 97, 0, 0, 87, 0, 9, 0, 2, 0, 0, 1, 0, 87, 0, 8, 5, 0, 1, 0, 91, 0, 10, 2, 0, 8, 3, 85, 0, 0, 0,
        0, 3, 0, 80, 0, 1, 0, 0, 3, 0, 51, 0, 2, 0, 0, 0, 0, 43, 0, 1, 0, 0, 0, 0, 35, 0, 1, 0, 0, 0, 0, 27, 0, 2, 0, 0,
        0, 0, 25, 0, 3, 0, 0, 0, 0, 12, 0, 1, 1, 0, 0, 0, 8,
      ],
      [
        24, 206, 0, 22, 173, 0, 160, 9, 6, 0, 12, 4, 2, 154, 0, 1, 1, 0, 0, 0, 152, 0, 0, 0, 0, 1, 1, 147, 0, 3, 0, 0,
        1, 0, 143, 0, 97, 0, 0, 87, 0, 15, 0, 2, 1, 0, 1, 0, 88, 5, 3, 0, 0, 1, 0, 92, 2, 6, 0, 3, 3, 0, 87, 0, 2, 2, 0,
        2, 2, 86, 0, 0, 0, 0, 3, 0, 81, 0, 1, 0, 0, 3, 0, 52, 0, 1, 0, 0, 0, 0, 46, 0, 1, 0, 0, 0, 0, 44, 0, 1, 0, 0, 0,
        0, 36, 0, 1, 0, 0, 0, 0, 28, 0, 2, 2, 0, 0, 0, 26, 0, 3, 0, 0, 0, 0, 13,
      ],
      [
        24, 206, 17, 22, 173, 19, 18, 9, 6, 6, 14, 2, 2, 155, 1, 3, 3, 1, 1, 1, 144, 0, 97, 0, 0, 87, 0, 95, 1, 1, 1, 0,
        1, 0, 89, 5, 3, 3, 0, 1, 1, 92, 2, 6, 1, 3, 3, 2, 88, 2, 0, 0, 2, 3, 3, 82, 0, 0, 0, 0, 1, 0, 73, 0, 0, 0, 0, 1,
        0, 64, 0, 1, 0, 0, 1, 0, 53, 0, 1, 0, 0, 0, 0, 47, 0, 1, 1, 0, 0, 0, 45, 0, 1, 0, 0, 0, 0, 37, 0, 1, 0, 0, 0, 0,
        29, 2, 3, 0, 0, 0, 0, 14,
      ],
      [
        41, 15, 3, 41, 10, 2, 212, 0, 26, 26, 0, 28, 28, 211, 0, 139, 0, 0, 108, 0, 166, 0, 2, 2, 0, 0, 0, 165, 0, 0, 0,
        0, 1, 0, 163, 0, 7, 0, 0, 7, 0, 161, 19, 73, 15, 18, 58, 4, 117, 0, 6, 0, 0, 3, 0, 116, 0, 18, 0, 0, 26, 0, 96,
        2, 0, 0, 0, 1, 1, 90, 11, 5, 3, 6, 1, 1, 89, 2, 0, 0, 5, 1, 0, 74, 0, 0, 0, 0, 1, 0, 65, 0, 1, 0, 0, 1, 0, 54,
        0, 1, 0, 0, 0, 0, 48, 1, 1, 0, 0, 0, 0, 38, 0, 1, 0, 0, 0, 0, 30, 2, 3, 0, 0, 0, 0, 9,
      ],
      [
        44, 12, 12, 43, 8, 8, 213, 26, 139, 0, 28, 108, 0, 167, 2, 0, 0, 0, 1, 1, 164, 0, 7, 7, 0, 7, 7, 162, 34, 32,
        14, 22, 29, 12, 137, 0, 26, 0, 0, 25, 0, 118, 0, 5, 0, 0, 3, 0, 87, 0, 1, 1, 0, 0, 0, 91, 0, 18, 0, 0, 26, 0,
        13, 16, 2, 2, 8, 0, 0, 90, 2, 0, 0, 5, 1, 0, 75, 0, 0, 0, 0, 1, 0, 65, 0, 1, 0, 0, 1, 0, 55, 0, 1, 0, 0, 0, 0,
        49, 1, 1, 0, 0, 0, 0, 39, 0, 1, 0, 0, 0, 0, 30, 2, 3, 0, 0, 0, 0, 15,
      ],
      [
        82, 139, 0, 79, 108, 0, 16, 57, 18, 14, 42, 17, 12, 138, 0, 20, 0, 0, 19, 0, 123, 0, 6, 0, 0, 6, 0, 119, 0, 5,
        2, 0, 3, 1, 88, 1, 18, 0, 0, 26, 0, 14, 20, 0, 0, 13, 1, 0, 76, 0, 0, 0, 0, 1, 0, 66, 0, 1, 0, 0, 1, 0, 56, 0,
        1, 1, 0, 0, 0, 50, 1, 1, 0, 0, 0, 0, 40, 0, 1, 0, 0, 0, 0, 31, 2, 3, 0, 0, 0, 0, 16,
      ],
      [
        82, 136, 0, 79, 107, 0, 170, 0, 3, 0, 0, 1, 0, 168, 71, 4, 4, 54, 5, 5, 139, 0, 20, 0, 0, 19, 0, 124, 0, 6, 0,
        0, 6, 0, 120, 2, 3, 3, 1, 2, 2, 89, 1, 18, 0, 0, 26, 0, 9, 20, 0, 0, 13, 1, 1, 77, 0, 0, 0, 0, 1, 0, 67, 0, 1,
        0, 0, 1, 0, 57, 2, 1, 0, 0, 0, 0, 41, 0, 1, 0, 0, 0, 0, 32, 2, 3, 0, 0, 0, 0, 17,
      ],
      [
        82, 136, 0, 79, 107, 0, 171, 0, 3, 3, 0, 1, 1, 169, 75, 20, 0, 59, 19, 0, 80, 0, 6, 0, 0, 6, 0, 121, 6, 18, 0,
        3, 26, 0, 15, 20, 0, 0, 14, 1, 0, 68, 0, 1, 0, 0, 1, 0, 58, 2, 1, 1, 0, 0, 0, 42, 0, 1, 0, 0, 0, 0, 33, 2, 3, 0,
        0, 0, 0, 13,
      ],
      [
        82, 136, 0, 79, 107, 0, 24, 78, 17, 0, 60, 12, 0, 127, 0, 1, 0, 0, 4, 0, 126, 0, 2, 2, 0, 3, 3, 125, 0, 6, 6, 0,
        6, 6, 122, 6, 18, 3, 3, 26, 2, 97, 20, 0, 0, 14, 1, 0, 69, 0, 1, 0, 0, 1, 0, 59, 3, 1, 1, 0, 0, 0, 34, 2, 3, 0,
        0, 0, 0, 14,
      ],
      [
        82, 42, 0, 79, 34, 0, 51, 0, 42, 2, 0, 31, 1, 43, 0, 29, 0, 0, 28, 0, 35, 0, 12, 0, 0, 4, 0, 27, 0, 10, 0, 0, 5,
        1, 25, 0, 1, 0, 0, 5, 0, 172, 78, 17, 0, 60, 12, 0, 128, 0, 1, 0, 0, 4, 0, 71, 17, 3, 0, 14, 1, 0, 112, 0, 7, 0,
        0, 14, 0, 110, 0, 3, 0, 0, 4, 0, 105, 0, 2, 0, 0, 5, 0, 98, 20, 0, 0, 14, 1, 0, 70, 0, 1, 0, 0, 1, 0, 60, 6, 3,
        0, 0, 0, 0, 9,
      ],
      [
        82, 42, 0, 79, 34, 0, 52, 2, 32, 0, 1, 24, 0, 46, 0, 8, 3, 0, 6, 4, 44, 0, 26, 1, 0, 24, 0, 36, 0, 3, 0, 0, 1,
        0, 182, 0, 0, 0, 0, 3, 0, 181, 0, 12, 0, 0, 4, 0, 28, 0, 10, 10, 1, 4, 4, 26, 0, 1, 1, 0, 5, 5, 173, 78, 3, 3,
        60, 2, 2, 136, 0, 14, 9, 0, 10, 9, 129, 0, 1, 1, 0, 4, 4, 72, 17, 3, 0, 14, 1, 0, 114, 0, 2, 0, 0, 6, 0, 112, 0,
        5, 5, 0, 8, 8, 111, 0, 0, 0, 0, 2, 0, 108, 0, 2, 0, 0, 1, 0, 107, 0, 1, 1, 0, 1, 1, 106, 0, 2, 0, 0, 5, 0, 99,
        20, 0, 0, 14, 1, 0, 71, 0, 1, 0, 0, 1, 0, 61, 6, 3, 0, 0, 0, 0, 15,
      ],
      [
        82, 3, 0, 79, 4, 0, 73, 0, 4, 0, 0, 7, 0, 208, 0, 9, 0, 0, 9, 0, 199, 0, 4, 0, 0, 1, 0, 64, 0, 22, 0, 0, 13, 0,
        53, 2, 3, 0, 1, 2, 0, 47, 0, 14, 1, 0, 10, 0, 194, 0, 11, 7, 0, 8, 3, 192, 0, 4, 2, 0, 4, 2, 153, 3, 5, 5, 4, 2,
        2, 45, 1, 25, 0, 0, 24, 0, 37, 0, 3, 0, 0, 1, 0, 183, 0, 0, 0, 0, 3, 3, 155, 0, 12, 0, 0, 3, 0, 174, 0, 0, 0, 0,
        1, 0, 29, 101, 5, 3, 81, 1, 0, 130, 18, 3, 3, 18, 1, 1, 115, 0, 2, 2, 0, 6, 6, 113, 5, 0, 0, 8, 2, 2, 109, 0, 2,
        2, 0, 1, 1, 106, 1, 2, 0, 1, 5, 0, 100, 20, 0, 0, 14, 1, 1, 72, 0, 1, 0, 0, 1, 0, 62, 6, 3, 0, 0, 0, 0, 18,
      ],
      [
        82, 3, 0, 79, 4, 0, 74, 0, 4, 0, 0, 7, 0, 209, 0, 9, 0, 0, 9, 0, 200, 0, 4, 0, 0, 1, 0, 65, 0, 22, 0, 0, 13, 0,
        54, 2, 3, 0, 1, 2, 0, 48, 1, 13, 0, 0, 10, 0, 37, 7, 4, 0, 3, 5, 0, 193, 2, 2, 1, 2, 2, 0, 154, 9, 25, 0, 6, 24,
        0, 38, 0, 3, 3, 0, 1, 0, 155, 0, 12, 0, 3, 3, 0, 175, 0, 0, 0, 0, 1, 0, 30, 104, 2, 0, 81, 1, 0, 131, 31, 2, 0,
        37, 5, 0, 95, 20, 1, 1, 15, 1, 1, 63, 6, 3, 0, 0, 0, 0, 12,
      ],
      [
        82, 2, 1, 79, 2, 0, 75, 0, 1, 0, 0, 1, 0, 201, 0, 0, 0, 0, 1, 1, 210, 0, 2, 1, 0, 4, 1, 75, 0, 1, 0, 0, 2, 0,
        201, 0, 1, 1, 0, 1, 1, 210, 0, 7, 2, 0, 9, 1, 75, 0, 2, 0, 0, 0, 0, 201, 0, 4, 0, 0, 1, 0, 65, 0, 22, 0, 0, 13,
        0, 55, 2, 3, 0, 1, 2, 0, 49, 1, 13, 0, 0, 10, 0, 38, 7, 1, 1, 3, 3, 3, 50, 0, 3, 3, 0, 2, 2, 155, 3, 1, 0, 2, 2,
        1, 155, 9, 25, 0, 6, 24, 0, 39, 3, 0, 0, 0, 1, 1, 184, 0, 12, 0, 3, 3, 0, 176, 0, 0, 0, 0, 1, 0, 30, 104, 2, 0,
        81, 1, 0, 132, 31, 1, 0, 37, 2, 0, 102, 0, 1, 1, 0, 3, 3, 101, 27, 3, 0, 16, 0, 0, 13,
      ],
      [
        83, 0, 0, 79, 1, 1, 206, 0, 1, 0, 0, 1, 0, 76, 0, 1, 0, 0, 1, 0, 202, 1, 0, 0, 2, 1, 1, 206, 0, 1, 0, 0, 2, 0,
        76, 0, 1, 0, 0, 2, 0, 202, 3, 5, 0, 2, 8, 0, 76, 0, 2, 0, 0, 0, 0, 202, 0, 4, 0, 0, 1, 0, 66, 0, 22, 0, 0, 13,
        0, 56, 2, 3, 3, 1, 2, 2, 50, 1, 13, 0, 0, 10, 0, 39, 14, 1, 1, 11, 1, 1, 184, 9, 12, 0, 6, 11, 0, 40, 0, 12, 12,
        0, 13, 13, 186, 0, 1, 1, 0, 0, 0, 185, 3, 12, 0, 4, 3, 0, 177, 0, 0, 0, 0, 1, 0, 31, 104, 2, 0, 81, 1, 0, 133,
        31, 1, 0, 37, 2, 0, 103, 28, 3, 0, 19, 0, 0, 14,
      ],
      [
        83, 1, 1, 80, 1, 1, 77, 0, 1, 1, 0, 1, 1, 203, 1, 1, 1, 3, 2, 2, 77, 0, 1, 1, 0, 2, 2, 203, 3, 4, 0, 2, 8, 0,
        204, 0, 1, 1, 0, 0, 0, 77, 0, 2, 2, 0, 0, 0, 203, 0, 4, 0, 0, 1, 0, 67, 0, 22, 0, 0, 13, 0, 57, 6, 5, 0, 3, 3,
        0, 40, 0, 8, 8, 0, 7, 7, 186, 24, 12, 0, 18, 11, 0, 41, 16, 12, 0, 17, 3, 0, 178, 0, 0, 0, 0, 1, 0, 32, 104, 2,
        0, 81, 1, 0, 134, 31, 1, 1, 37, 2, 2, 104, 28, 3, 0, 19, 0, 0, 9,
      ],
      [
        91, 4, 1, 91, 8, 0, 205, 3, 4, 0, 0, 1, 0, 68, 0, 7, 0, 0, 2, 0, 58, 0, 15, 15, 0, 11, 11, 186, 6, 5, 0, 3, 3,
        0, 195, 32, 2, 0, 25, 1, 0, 190, 0, 0, 0, 0, 1, 1, 42, 0, 1, 1, 0, 2, 2, 189, 0, 4, 4, 0, 3, 3, 188, 0, 5, 0, 0,
        4, 0, 187, 16, 12, 0, 17, 3, 0, 179, 0, 0, 0, 0, 1, 0, 33, 104, 2, 2, 81, 1, 1, 135, 60, 3, 0, 58, 0, 0, 15,
      ],
      [
        92, 0, 0, 91, 3, 1, 206, 0, 3, 0, 0, 5, 0, 76, 3, 4, 0, 0, 1, 0, 69, 0, 7, 0, 0, 2, 0, 59, 21, 0, 0, 14, 1, 1,
        198, 0, 5, 0, 0, 2, 0, 187, 32, 2, 0, 25, 1, 0, 191, 5, 5, 5, 6, 4, 4, 63, 16, 12, 0, 17, 3, 0, 180, 0, 0, 0, 0,
        1, 1, 34, 166, 3, 0, 140, 0, 0, 19,
      ],
      [
        92, 0, 0, 92, 2, 0, 207, 0, 3, 3, 0, 5, 5, 77, 3, 4, 0, 0, 1, 0, 70, 0, 7, 0, 0, 2, 0, 60, 21, 4, 4, 15, 2, 2,
        63, 0, 1, 0, 0, 0, 0, 196, 32, 2, 0, 25, 1, 0, 62, 26, 12, 12, 27, 3, 3, 34, 166, 3, 0, 141, 0, 0, 20,
      ],
      [
        92, 0, 0, 92, 2, 2, 203, 6, 4, 0, 5, 1, 0, 71, 0, 7, 0, 0, 2, 0, 61, 25, 1, 1, 17, 0, 0, 197, 32, 2, 2, 25, 1,
        1, 63, 204, 3, 0, 171, 0, 0, 21,
      ],
      [98, 4, 4, 99, 1, 1, 72, 0, 7, 0, 0, 2, 0, 62, 264, 3, 0, 214, 0, 0, 22],
      [102, 7, 7, 100, 2, 2, 63, 264, 3, 3, 214, 0, 0, 23],
    ];
    const names = [
      'total',
      'System.Threading!ThreadPoolWorkQueueThreadLocals.Finalize',
      'System.Threading!ThreadPoolWorkQueue.WorkStealingQueueList.Remove',
      'System.Threading!PortableThreadPool.WorkerThread.WorkerThreadStart',
      'System.Threading!ThreadPoolWorkQueue.Dispatch',
      'System.Threading!UnmanagedThreadPoolWorkItem.System.Threading.IThreadPoolWorkItem.Execute',
      'System.Threading!TimerQueue.FireNextTimers',
      'System.Threading!TimerQueueTimer.Fire',
      'Microsoft.Extensions.FileProviders.Physical!PhysicalFilesWatcher.RaiseChangeEvents',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder.AsyncStateMachineBox<TResult, TResult>.MoveNext',
      'System.Threading!ExecutionContext.RunFromThreadPoolDispatchLoop',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder.SetResult',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.SetExistingTaskResult',
      'System.Threading.Tasks!Task.RunContinuations',
      'System.Threading.Tasks!AwaitTaskContinuation.RunOrScheduleAction',
      'System.Threading!ExecutionContext.RunInternal',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol.<ProcessRequestsAsync>d__222<TContext>.MoveNext',
      'System.Threading.Tasks!Task<System.Threading.Tasks!VoidTaskResult>.TrySetResult',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal!HttpConnection.<ProcessRequestsAsync>d__12<TContext>.MoveNext',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!KestrelConnection.<ExecuteAsync>d__6<T>.MoveNext',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.DisposeAsync',
      'System.Runtime.CompilerServices!AsyncMethodBuilderCore.Start<!<DisposeAsync>d__26>',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.<DisposeAsync>d__26.MoveNext',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.GetStateMachineBox<!<DisposeAsync>d__26>',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol.<ProcessRequests>d__223<TContext>.MoveNext',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol.InitializeBodyControl',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!BodyControl..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1Connection.TryParseRequest',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1Connection.ParseRequest',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1Connection.TakeStartLine',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpParser<Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1ParsingHandler>.ParseRequestLine',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1Connection.OnStartLine',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1Connection.OnOriginFormTarget',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!StringUtilities.GetAsciiStringNonNullCharacters',
      'System!String.Create<System!IntPtr>',
      'Microsoft.AspNetCore.Hosting!HostingApplication.DisposeContext',
      'Microsoft.AspNetCore.Hosting!HostingApplicationDiagnostics.LogRequestFinished',
      'Microsoft.Extensions.Logging!Logger.Log<!T0>',
      'Microsoft.Extensions.Logging!Logger.<Log>g__LoggerLog|12_0<!T0>',
      'Microsoft.Extensions.Logging.Console!ConsoleLogger.Log<!T0>',
      'Microsoft.Extensions.Logging.Console!SimpleConsoleFormatter.Write<!T0>',
      'Microsoft.AspNetCore.Hosting!HostingRequestFinishedLog.ToString',
      'System!Number.UInt32ToDecStr',
      'Microsoft.AspNetCore.Hosting!HostingApplication.CreateContext',
      'Microsoft.AspNetCore.Http!DefaultHttpContextFactory.Create',
      'Microsoft.AspNetCore.Http!DefaultHttpContext..ctor',
      'Microsoft.AspNetCore.Hosting!HostingApplicationDiagnostics.BeginRequest',
      'Microsoft.AspNetCore.Hosting!HostingApplicationDiagnostics.Log.RequestScope',
      'Microsoft.AspNetCore.Hosting!HostingApplicationDiagnostics.Log.HostingLogScope..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol.Microsoft.AspNetCore.Http.Features.IHttpRequestIdentifierFeature.get_TraceIdentifier',
      'System!String.Create<System!ValueTuple>',
      'Microsoft.AspNetCore.HostFiltering!HostFilteringMiddleware.Invoke',
      'Microsoft.AspNetCore.Routing!EndpointMiddleware.Invoke',
      'Microsoft.Extensions.Logging!LoggerMessage.<>c__DisplayClass10_0<T1>.<Define>g__Log|0',
      'Microsoft.Extensions.Logging!Logger<T>.Microsoft.Extensions.Logging.ILogger.Log<!LogValues>',
      'Microsoft.Extensions.Logging!Logger.Log<!LogValues>',
      'Microsoft.Extensions.Logging!Logger.<Log>g__LoggerLog|12_0<!LogValues>',
      'Microsoft.Extensions.Logging.Console!ConsoleLogger.Log<!LogValues>',
      'Microsoft.Extensions.Logging.Console!SimpleConsoleFormatter.Write<!LogValues>',
      'Microsoft.Extensions.Logging!LoggerMessage.LogValues.<>c<T0>.<.cctor>b__12_0',
      'Microsoft.Extensions.Logging!LoggerMessage.LogValues<T0>.ToString',
      'System!String.FormatHelper',
      'System!Span<System!Char>.ToString',
      'System!String.Ctor',
      'Microsoft.AspNetCore.Http!RequestDelegateFactory.ExecuteWriteStringResponseAsync',
      'Microsoft.AspNetCore.Http!HttpResponseWritingExtensions.WriteAsync',
      'Microsoft.AspNetCore.Http!DefaultHttpResponse.StartAsync',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol.Microsoft.AspNetCore.Http.Features.IHttpResponseBodyFeature.StartAsync',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1OutputProducer.WriteResponseHeaders',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure.PipeWriterHelpers!ConcurrentPipeWriter.GetSpan',
      'System.IO.Pipelines!Pipe.DefaultPipeWriter.GetSpan',
      'System.IO.Pipelines!Pipe.AllocateWriteHeadSynchronized',
      'System.IO.Pipelines!Pipe.CreateSegmentUnsynchronized',
      'Example!Program.<>c__DisplayClass0_0.<Main>b__0',
      'Example!BikeService.Order',
      'Example!OrderService.FindNearestVehicle',
      'Pyroscope!LabelsWrapper.Do',
      'Pyroscope!Profiler.get_Instance',
      'System.Net.Sockets!SocketAsyncEngine.System.Threading.IThreadPoolWorkItem.Execute',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder.AsyncStateMachineBox<System.Threading.Tasks!VoidTaskResult, Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.<DoReceive>d__27>.MoveNext',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.<DoReceive>d__27.MoveNext',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.FireConnectionClosed',
      'System.Threading!ThreadPool.UnsafeQueueUserWorkItem<!T0>',
      'System.Net.Sockets!SocketAsyncEventArgs.AcceptCompletionCallback',
      'System.Net.Sockets!SocketAsyncEventArgs.FinishOperationSyncSuccess',
      'System.Net.Sockets!SocketAsyncEventArgs.FinishOperationAccept',
      'System.Net.Sockets!SocketPal.CreateSocket',
      'System.Net.Sockets!IPEndPointExtensions.Create',
      'System.Net.Internals!SocketAddress.GetIPEndPoint',
      'System.Net.Internals!SocketAddress.GetIPAddress',
      'System.Net!IPAddress..ctor',
      'System.Net.Sockets!IPEndPointExtensions.Serialize',
      'System.Net.Internals!SocketAddress..ctor',
      'System.Net.Sockets!Socket.AwaitableSocketAsyncEventArgs.OnCompleted',
      'System.Net.Sockets!Socket.AwaitableSocketAsyncEventArgs.InvokeContinuation',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets!SocketConnectionListener.<AcceptAsync>d__10.MoveNext',
      'System.Threading.Tasks!Task<TResult>.TrySetResult',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal!ConnectionDispatcher.<>c__DisplayClass8_0.<<StartAcceptingConnectionsCore>g__AcceptConnectionsAsync|0>d<T>.MoveNext',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!TransportManager.GenericConnectionListener.AcceptAsync',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets!SocketConnectionListener.AcceptAsync',
      'System.Runtime.CompilerServices!AsyncMethodBuilderCore.Start<!<AcceptAsync>d__10>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<TResult>.GetStateMachineBox<!<AcceptAsync>d__10>',
      'System.Net.Sockets!Socket.AwaitableSocketAsyncEventArgs.AcceptAsync',
      'System.Net.Sockets!Socket.AcceptAsync',
      'System.Net.Sockets!SocketAsyncEventArgs.DoOperationAccept',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!TransportConnectionManager.AddConnection',
      'System.Collections.Concurrent!ConcurrentDictionary<TKey, TKey>.TryAddInternal',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!ConnectionManager.AddConnection',
      'Microsoft.AspNetCore.Connections!TransportConnection.get_ConnectionId',
      'System!String.Create<System!Int64>',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!KestrelConnection<T>..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!KestrelConnection..ctor',
      'Microsoft.AspNetCore.Connections!TransportConnection.Microsoft.AspNetCore.Http.Features.IFeatureCollection.Set<!T0>',
      'Microsoft.AspNetCore.Connections!TransportConnection.ExtraFeatureSet',
      'System.Collections.Generic!List<T>.AddWithResize',
      'System.Collections.Generic!List<T>.set_Capacity',
      'System.Net.Sockets!Socket.get_LocalEndPoint',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets!SocketConnectionContextFactory.Create',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.Start',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.DoSend',
      'System.Runtime.CompilerServices!AsyncMethodBuilderCore.Start<!<DoSend>d__28>',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.<DoSend>d__28.MoveNext',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.GetStateMachineBox<!<DoSend>d__28>',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.DoReceive',
      'System.Runtime.CompilerServices!AsyncMethodBuilderCore.Start<!<DoReceive>d__27>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.GetStateMachineBox<!<DoReceive>d__27>',
      'System.IO.Pipelines!Pipe.GetMemory',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketReceiver.WaitForDataAsync',
      'System.Net.Sockets!Socket.ReceiveAsync',
      'System.Net.Sockets!SocketAsyncEventArgs.DoOperationReceive',
      'System.Net.Sockets!SocketAsyncContext.ReceiveAsync',
      'System.Net.Sockets!SocketAsyncContext.OperationQueue<TOperation>.StartAsyncOperation',
      'System.Net.Sockets!SocketAsyncContext.TryRegister',
      'System.Net.Sockets!SocketAsyncEngine.TryRegisterSocket',
      'System.Net.Sockets!SocketAsyncEngine.TryRegisterCore',
      'System.Collections.Concurrent!ConcurrentDictionary<System!IntPtr, System.Net.Sockets!SocketAsyncEngine.SocketAsyncContextWrapper>.TryAddInternal',
      'System.Net.Sockets!SocketAsyncContext..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection..ctor',
      'System.IO.Pipelines!DuplexPipe.CreateConnectionPair',
      'System.IO.Pipelines!Pipe..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.<>c.<FireConnectionClosed>b__29_0',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.CancelConnectionClosedToken',
      'System.Threading!CancellationTokenSource.ExecuteCallbackHandlers',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal!HttpConnection.OnConnectionClosed',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1Connection.OnInputOrOutputCompleted',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!IOQueue.System.Threading.IThreadPoolWorkItem.Execute',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder.AsyncStateMachineBox<System.Threading.Tasks!VoidTaskResult, Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.<DoSend>d__28>.MoveNext',
      'Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets.Internal!SocketConnection.Shutdown',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!KestrelConnection<T>.System.Threading.IThreadPoolWorkItem.Execute',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!KestrelConnection<T>.ExecuteAsync',
      'System.Runtime.CompilerServices!AsyncMethodBuilderCore.Start<!<ExecuteAsync>d__6>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.AwaitUnsafeOnCompleted<System.Runtime.CompilerServices!TaskAwaiter, !<ExecuteAsync>d__6>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.GetStateMachineBox<!<ExecuteAsync>d__6>',
      'Microsoft.Extensions.Logging!Logger.BeginScope<!T0>',
      'Microsoft.Extensions.Logging!LoggerFactoryScopeProvider.Push',
      'System.Threading!ExecutionContext.SetLocalValue',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!TimeoutControl..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!KestrelConnection.BeginConnectionScope',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal!HttpConnectionMiddleware<TContext>.OnConnectionAsync',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal!HttpConnection.ProcessRequestsAsync<!T0>',
      'System.Runtime.CompilerServices!AsyncMethodBuilderCore.Start<!<ProcessRequestsAsync>d__12>',
      'System.Threading!CancellationToken.Register',
      'System.Threading!CancellationTokenSource.Register',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.AwaitUnsafeOnCompleted<System.Runtime.CompilerServices!TaskAwaiter, !<ProcessRequestsAsync>d__12>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.GetStateMachineBox<!<ProcessRequestsAsync>d__12>',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!KestrelConnection.OnHeartbeat',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol.ProcessRequestsAsync<!T0>',
      'System.Runtime.CompilerServices!AsyncMethodBuilderCore.Start<!<ProcessRequestsAsync>d__222>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.AwaitUnsafeOnCompleted<System.Runtime.CompilerServices!TaskAwaiter, !<ProcessRequestsAsync>d__222>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.GetStateMachineBox<!<ProcessRequestsAsync>d__222>',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol.ProcessRequests<!T0>',
      'System.Runtime.CompilerServices!AsyncMethodBuilderCore.Start<!<ProcessRequests>d__223>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.AwaitUnsafeOnCompleted<System.Runtime.CompilerServices!ValueTaskAwaiter, !<ProcessRequests>d__223>',
      'System.Runtime.CompilerServices!AsyncTaskMethodBuilder<System.Threading.Tasks!VoidTaskResult>.GetStateMachineBox<!<ProcessRequests>d__223>',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1Connection.TakeMessageHeaders',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpParser<Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1ParsingHandler>.ParseHeaders',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpParser<Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1ParsingHandler>.TryTakeSingleHeader',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol.OnHeader',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpRequestHeaders.Append',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!HttpUtilities.GetRequestHeaderString',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!StringUtilities.GetAsciiOrUTF8StringNonNullCharacters',
      'Microsoft.Extensions.Logging!LoggerFactoryScopeProvider.Scope.Dispose',
      'Microsoft.AspNetCore.Hosting!HostingApplicationDiagnostics.StopActivity',
      'System.Diagnostics!Activity.Stop',
      'System.Threading!AsyncLocalValueMap.TwoElementAsyncLocalValueMap.Set',
      'System.Text!StringBuilder.set_Length',
      'System.Text!StringBuilder.ToString',
      'System.Runtime.CompilerServices!DefaultInterpolatedStringHandler.ToStringAndClear',
      'System!String.Substring',
      'System!String.Replace',
      'System!Number.FormatDouble',
      'System.Text!ValueStringBuilder.ToString',
      'Microsoft.AspNetCore.Hosting!HostingApplicationDiagnostics.StartActivity',
      'System.Diagnostics!Activity.Start',
      'Microsoft.AspNetCore.Hosting!HostingApplicationDiagnostics.LogRequestStarting',
      'Microsoft.AspNetCore.Hosting!HostingRequestStartingLog.ToString',
      'System.Buffers!TlsOverPerCoreLockedStacksArrayPool<System!Char>.Return',
      'System.Buffers!TlsOverPerCoreLockedStacksArrayPool<System!Char>.InitializeTlsBucketsAndTrimming',
      'System.Buffers!TlsOverPerCoreLockedStacksArrayPool<System!Char>.Rent',
      'Example!Program.<>c__DisplayClass0_0.<Main>b__2',
      'Example!CarService.Order',
      'Pyroscope!LabelSet.Builder.Add',
      'System.Collections.Generic!Dictionary<TKey, TKey>.TryInsert',
      'System.Collections.Generic!Dictionary<TKey, TKey>.Initialize',
      'Example!OrderService.<>c__DisplayClass0_1.<FindNearestVehicle>b__0',
      'Example!OrderService.CheckDriverAvailability',
      'Pyroscope!LabelSet.BuildUpon',
      'System.Collections.Generic!Dictionary<TKey, TKey>..ctor',
      'Example!Program.<>c__DisplayClass0_0.<Main>b__1',
      'Example!ScooterService.Order',
      'Pyroscope!LabelSet.Builder.Build',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!HttpProtocol..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1Connection..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!Http1OutputProducer..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal!HttpConnection..ctor',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!Heartbeat.<>c.<.ctor>b__8_0',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!Heartbeat.TimerLoop',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Infrastructure!Heartbeat.OnHeartbeat',
      'Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http!DateHeaderValueManager.SetDateValues',
      'Microsoft.Net.Http.Headers!HeaderUtilities.FormatDate',
      'System!DateTimeFormat.Format',
    ];

    const nodeLevels: any[][] = [];
    for (let i = 0; i < levels.length; i++) {
      nodeLevels[i] = [];
      for (const node of getNodes(levels[i], names)) {
        node.level = i;
        nodeLevels[i].push(node);
        if (i > 0) {
          const prevNodesInLevel = nodeLevels[i].slice(0, -1);
          const currentNodeStart =
            prevNodesInLevel.reduce((acc: number, n: any) => n.offsetTotal + n.valTotal + acc, 0) + node.offsetTotal;

          const prevLevel = nodeLevels[i - 1];
          let prevLevelOffset = 0;
          for (const prevLevelNode of prevLevel) {
            const parentNodeStart = prevLevelOffset + prevLevelNode.offsetTotal;
            const parentNodeEnd = parentNodeStart + prevLevelNode.valTotal;

            if (parentNodeStart <= currentNodeStart && parentNodeEnd > currentNodeStart) {
              prevLevelNode.children.push(node);
              break;
            } else {
              prevLevelOffset += prevLevelNode.offsetTotal + prevLevelNode.valTotal;
            }
          }
        }
      }
    }

    const root = nodeLevels[0][0];
    const stack = [root];

    const labelValues = [];
    const levelValues = [];
    const selfValues = [];
    const valueValues = [];
    const selfRightValues = [];
    const valueRightValues = [];

    while (stack.length) {
      const node = stack.shift();
      labelValues.push(node.label);
      levelValues.push(node.level);
      selfValues.push(node.self);
      valueValues.push(node.val);
      selfRightValues.push(node.selfRight);
      valueRightValues.push(node.valRight);
      stack.unshift(...node.children);
    }

    const frame: DataFrameDTO = {
      name: 'response',
      // @ts-ignore
      meta: { preferredVisualisationType: 'flamegraph' },
      fields: [
        { name: 'level', values: levelValues },
        { name: 'label', values: labelValues },
        { name: 'self', values: selfValues },
        { name: 'value', values: valueValues },
        { name: 'selfRight', values: selfRightValues },
        { name: 'valueRight', values: valueRightValues },
      ],
    };
    console.log(JSON.stringify(frame));
  });
});

function getNodes(level: number[], names: string[]) {
  const nodes = [];
  for (let i = 0; i < level.length; i += 7) {
    nodes.push({
      level: 0,
      label: names[level[i + 6]],
      self: level[i + 2],
      val: level[i + 1],
      selfRight: level[i + 5],
      valRight: level[i + 4],
      valTotal: level[i + 1] + level[i + 4],
      offset: level[i],
      offsetRight: level[i + 3],
      offsetTotal: level[i] + level[i + 3],
      children: [],
    });
  }
  return nodes;
}
