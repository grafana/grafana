import { useEffect, useRef, useState } from 'react';

import { LogLevel, LogRowModel } from '@grafana/data';
import { createLogRow } from 'app/features/logs/components/mocks/logRow';

const map = `Score: 000000                              Lives: ♥♥♥♥
================================================================================
                                                                                
                                   [=U=]        
                                                                                                                                                            
      <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>
      [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]
      <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>
      <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>
                                                                                
            

      


            ###              ###              ###              ###            
           #####            #####            #####            #####           
          #######          #######          #######          #######          
           #####            #####            #####            #####           
            ###              ###              ###              ###            
                                                                                
                                                                                
                                                                      
/A\\
================================================================================`;

const player = '/A\\';
const initialPlayerX = 39;
const playerY = 23;

const userMissile = '╫';
const userMissileRegex = new RegExp(userMissile, 'g');
const missileSpeed = 0.06;
const enemySpeed = 0.001;

type Missile = {
  x: number;
  y: number;
  get gridY(): number;
  hit: boolean;
};
type Enemy = {
  x: number;
  get gridX(): number;
  sourceX: number;
  direction: 'l' | 'r';
  y: number;
  type: number;
  body: string;
  health: number;
};
const ufo = '[=U=]';
const enemyTypes = ['<@_@>', '<^_^>', '[-_-]', '<o_o>', ufo];
const enemyTypeUfo = enemyTypes.indexOf(ufo);
const explosion = 'xX*Xx';
const enemySprites = [
  [explosion, '<@_@>'],
  [explosion, ' ^_^ ', '<^_^>'],
  [explosion, ' -_- ', '(-_-)', '[-_-]'],
  [explosion, ' o_o ', 'co_oↄ', '<o_o>', '<o_o>'],
  [explosion, ' =u= ', '(=u=)', ufo, ufo, ufo],
];

const shield = '#';

export function useLogsGames() {
  const [gameState, setGameState] = useState<LogRowModel[] | undefined>(undefined);
  const [playerX, setPlayerX] = useState(initialPlayerX);
  const [userMissiles, setUserMisiles] = useState<Missile[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const pendingUpdates = useRef(true);

  const lastTime = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    function loop(t: number) {
      const dt = t - lastTime.current;
      lastTime.current = t;

      const { newGameState, newUserMissiles, newEnemies } = update(dt, gameState, playerX, userMissiles, enemies);

      setGameState(newGameState);
      setUserMisiles(newUserMissiles);
      setEnemies(newEnemies);

      frame.current = requestAnimationFrame(loop);
    }

    frame.current = requestAnimationFrame(loop);

    return () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [enemies, gameState, playerX, userMissiles]);

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight' && e.code !== 'Space') {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      pendingUpdates.current = true;

      if (e.code === 'ArrowLeft') {
        setPlayerX(Math.max(playerX - 1, 0));
      } else if (e.code === 'ArrowRight') {
        setPlayerX(Math.min(playerX + 1, 80));
      } else if (e.code === 'Space' && userMissiles.length < 2) {
        setUserMisiles([...userMissiles, newUserMissile(playerX, playerY - 1)]);
      }
    }
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [playerX, userMissiles]);

  return gameState;
}

function update(
  dt: number,
  gameState: LogRowModel[] | undefined,
  playerX: number,
  userMissiles: Missile[],
  enemies: Enemy[]
) {
  if (gameState === undefined) {
    const newEnemies: Enemy[] = [];
    const logs = map.split('\n').map((row, index) => {
      if (index === playerY) {
        row = row.padStart(initialPlayerX, ' ');
      }
      const foundEnemies = createEnemies(row, index);
      if (foundEnemies) {
        newEnemies.push(...foundEnemies);
      }
      return createLogRow({
        uid: index.toString(),
        entry: row.padEnd(80),
        timeEpochMs: 0,
        logLevel: LogLevel.unknown,
      });
    });
    return { newGameState: logs, newUserMissiles: userMissiles, newEnemies: newEnemies };
  }

  let newUserMissiles = userMissiles
    .map((missile) => {
      missile.y = missile.y - missileSpeed * dt;
      return missile;
    })
    .filter((missile) => missile.y >= 2);

  const newEnemies = enemies
    .map((enemy) => {
      const shieldStart = gameState.findIndex((row) => row.entry.includes('#'));
      const enemyBelow = enemies.find((otherEnemy) => shieldStart && otherEnemy.y === shieldStart - 1);

      if (enemy.health === 0) {
        enemy.health -= 1;
      } else if (enemy.direction === 'r') {
        enemy.x = enemy.x + enemySpeed * dt;
        if (enemy.type === enemyTypeUfo) {
          if (enemy.gridX === 74) {
            enemy.direction = 'l';
          }
        } else if (enemy.gridX - enemy.sourceX >= 5) {
          enemy.direction = 'l';
          if (!enemyBelow) {
            enemy.y += 1;
          }
        }
      } else {
        enemy.x = enemy.x - enemySpeed * dt;
        if (enemy.type === enemyTypeUfo) {
          if (enemy.gridX === 0) {
            enemy.direction = 'r';
          }
        } else if (enemy.gridX - enemy.sourceX <= -5) {
          enemy.direction = 'r';
          if (!enemyBelow) {
            enemy.y += 1;
          }
        }
      }
      return enemy;
    })
    .map((enemy) => {
      const missile = userMissiles.find(
        (missile) => missile.gridY === enemy.y && missile.x >= enemy.gridX && missile.x <= enemy.gridX + 4
      );
      if (missile && enemy.health > 0) {
        missile.hit = true;
        enemy.health -= 1;
      }
      return enemy;
    })
    .filter((enemy) => enemy.health >= 0);

  newUserMissiles = newUserMissiles.filter((missile) => missile.hit === false);

  const newGameState = gameState.map((row, index) => {
    if (index <= 2 || index > playerY) {
      return row;
    } else if (index === playerY) {
      row.entry = player.padStart(playerX, ' ');
    } else if (row.entry.includes(shield)) {
      row.entry = handleEnvironmentCollisions(row.entry, newUserMissiles, index);
      newUserMissiles = newUserMissiles.filter((missile) => missile.hit === false);
    } else {
      row.entry = render(row.entry, newEnemies, newUserMissiles, index);
    }
    return createLogRow({
      uid: index.toString(),
      entry: row.entry.padEnd(80),
      timeEpochMs: 0,
      logLevel: LogLevel.unknown,
    });
  });

  return { newGameState, newUserMissiles, newEnemies };
}

function newUserMissile(x: number, y: number): Missile {
  return {
    x: x - 2,
    y,
    get gridY() {
      return Math.ceil(this.y);
    },
    hit: false,
  };
}

function createEnemies(row: string, y: number) {
  const enemies: Enemy[] = [];
  for (let i = 0; i < enemyTypes.length; ) {
    const index = row.indexOf(enemyTypes[i]);
    if (index >= 0) {
      const enemy: Enemy = {
        x: index,
        get gridX() {
          return Math.floor(this.x);
        },
        sourceX: index,
        direction: 'r',
        y,
        type: i,
        body: enemyTypes[i],
        health: i + 1,
      };
      enemies.push(enemy);
      row = row.replace(enemyTypes[i], '     ');
    } else {
      i++;
    }
  }
  return enemies.length ? enemies : undefined;
}

function handleEnvironmentCollisions(row: string, userMissiles: Missile[], y: number) {
  const missiles = userMissiles.filter((missile) => missile.gridY === y);
  missiles.forEach((missile) => {
    if (row.charAt(missile.x) === shield) {
      row = row.substring(0, missile.x) + ' ' + row.substring(missile.x + 1);
      missile.hit = true;
    }
  });
  return row;
}

function render(row: string, enemies: Enemy[], userMissiles: Missile[], y: number) {
  row = row.replace(userMissileRegex, ' ');
  enemies = enemies.filter((enemy) => enemy.y === y);
  userMissiles = userMissiles.filter((missile) => missile.gridY === y);

  if (!enemies.length && !userMissiles.length) {
    return '';
  }

  let newRow = '';

  for (let i = 0; i < 80; ) {
    const enemy = enemies.find((enemy) => enemy.gridX === i);
    const missile = userMissiles.find((missile) => missile.x === i);
    if (enemy) {
      newRow += enemySprites[enemy.type][enemy.health];
      i += 5;
    } else if (missile) {
      newRow += userMissile;
      i++;
    } else {
      newRow += ' ';
      i++;
    }
  }

  return newRow;
}
