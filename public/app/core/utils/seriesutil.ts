///<reference path="../../headers/common.d.ts" />

export function seriesRefLetters(num) {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (num < letters.length) {
      return letters[num];
    } else {
      return seriesRefLetters(Math.floor(num / letters.length) - 1) + letters[num % letters.length];
    }
}

